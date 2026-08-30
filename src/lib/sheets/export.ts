/**
 * Google Sheets export.
 *
 * This is the one operation that genuinely has to run on the server: it holds
 * a service-account private key, which must never reach a browser. Everything
 * else in the app talks to Postgres directly under row-level security.
 *
 * The export is additive and one-way. It appends submitted weeks to the
 * spreadsheet Finance already uses; it never reads the sheet back, so nobody
 * can corrupt real timesheet data by editing a cell.
 *
 * This file is imported by the admin page. Only the `createServerFn` wrapper
 * survives in the browser bundle -- the handler body, and with it the
 * credential-handling import below, is stripped out at build time.
 *
 * It therefore lives here rather than under `lib/server/`, which TanStack
 * Start's import protection blocks client code from reaching at all. The
 * module that actually touches the private key, `client.server.ts`, is
 * imported only inside the handler and never reaches the browser.
 */
import { createServerClient } from "@supabase/ssr";
import { createServerFn } from "@tanstack/react-start";
import { getCookies } from "@tanstack/react-start/server";

import { escapeRow } from "@/lib/sheets/escape";
import { TIMESHEET_ENTRIES_TAB, entryToRow, type ExportEntryRow } from "@/lib/sheets/schema";
import { appendRows, readSheetsCredentials } from "@/lib/sheets/client.server";

/**
 * A Supabase client bound to the caller's own session cookies, so row-level
 * security applies exactly as it would in the browser. The service role key is
 * never used here: an admin exporting a week is still subject to the admin
 * policies, not above them.
 */
function callerClient() {
  const url = process.env["VITE_SUPABASE_URL"];
  const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase is not configured on the server");

  const cookies = getCookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
      // The export never mutates the session, so writes are intentionally a
      // no-op rather than an attempt to set headers mid-response.
      setAll: () => undefined,
    },
  });
}

interface ExportResult {
  ok: boolean;
  reason?: "not_configured" | "not_authorized" | "nothing_to_export" | "failed";
  rowsWritten: number;
  message: string;
}

export const exportWeekToSheets = createServerFn({ method: "POST" })
  .validator((input: unknown): { weekStart: string } => {
    const value = input as { weekStart?: unknown };
    const weekStart = typeof value?.weekStart === "string" ? value.weekStart : "";
    // Reject anything that is not a plain ISO date before it reaches the query.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      throw new Error("invalid_week_start");
    }
    return { weekStart };
  })
  .handler(async ({ data }): Promise<ExportResult> => {
    const credentials = readSheetsCredentials();
    if (!credentials) {
      return {
        ok: false,
        reason: "not_configured",
        rowsWritten: 0,
        message: "The Google Sheets export is not configured.",
      };
    }

    const supabase = callerClient();

    // Confirm the caller is a signed-in admin. The database would refuse the
    // query below anyway; this produces a clearer answer.
    const { data: profile } = await supabase
      .from("ts_employees")
      .select("role, active")
      .maybeSingle();

    if (!profile || profile.role !== "admin" || !profile.active) {
      return {
        ok: false,
        reason: "not_authorized",
        rowsWritten: 0,
        message: "You do not have permission to export timesheets.",
      };
    }

    const { data: rows, error } = await supabase.rpc("ts_export_week", {
      p_week_start: data.weekStart,
    });

    if (error) {
      console.error("[timesheets] export query failed", { code: error.code });
      return { ok: false, reason: "failed", rowsWritten: 0, message: "Could not read the week." };
    }

    const entries = (rows ?? []) as ExportEntryRow[];
    if (entries.length === 0) {
      return {
        ok: true,
        reason: "nothing_to_export",
        rowsWritten: 0,
        message: "No submitted entries for that week.",
      };
    }

    try {
      // Every cell is escaped so a project note can never become a formula.
      const written = await appendRows(
        credentials,
        credentials.tabName,
        entries.map((entry) => escapeRow(entryToRow(entry))),
      );
      return {
        ok: true,
        rowsWritten: written,
        message: `Exported ${written} row${written === 1 ? "" : "s"}.`,
      };
    } catch (cause) {
      // The message may echo request details, so only its shape is logged.
      console.error("[timesheets] sheets append failed", {
        name: cause instanceof Error ? cause.name : "unknown",
      });
      return {
        ok: false,
        reason: "failed",
        rowsWritten: 0,
        message: "Could not write to the Google Sheet.",
      };
    }
  });
