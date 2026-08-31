import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown, Download, Loader2 } from "lucide-react";
import { endOfMonth, format, startOfMonth } from "date-fns";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchExportRows, type ExportRow } from "@/lib/data/api";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import { parseDateKey, toDateKey, weekEnd } from "@/lib/domain/week";
import type { Market } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * The columns available to export, in file order.
 *
 * Which of them are included is chosen in the UI rather than in code, so the
 * export can be reshaped for whoever is asking for it without a change here
 * and without a deploy.
 */
const COLUMNS = [
  { key: "work_date", label: "Date", value: (r: ExportRow) => r.workDate },
  { key: "employee_name", label: "Employee", value: (r: ExportRow) => r.employeeName },
  { key: "employee_email", label: "Email", value: (r: ExportRow) => r.employeeEmail },
  { key: "market", label: "Market", value: (r: ExportRow) => r.market },
  { key: "department", label: "Department", value: (r: ExportRow) => r.department },
  { key: "client_name", label: "Client", value: (r: ExportRow) => r.clientName },
  { key: "service_name", label: "Service", value: (r: ExportRow) => r.serviceName },
  { key: "project_type", label: "Project type", value: (r: ExportRow) => r.projectType },
  { key: "task_description", label: "Task", value: (r: ExportRow) => r.taskDescription },
  { key: "hours", label: "Hours", value: (r: ExportRow) => Number(r.hours) },
  {
    key: "scope",
    label: "Scope",
    value: (r: ExportRow) =>
      r.scope === "out_of_scope" ? "Out of Scope" : r.scope === "in_scope" ? "In Scope" : "",
  },
  {
    key: "billing_type",
    label: "Billable",
    value: (r: ExportRow) => (r.billable ? "Billable" : "Non-billable"),
  },
  { key: "notes", label: "Notes", value: (r: ExportRow) => r.notes },
  { key: "week_start", label: "Week start", value: (r: ExportRow) => r.weekStart },
  { key: "status", label: "Status", value: (r: ExportRow) => r.status },
  { key: "submitted_at", label: "Submitted at", value: (r: ExportRow) => r.submittedAt },
] as const;

const STORAGE_KEY = "kijamii-export-columns";
const DEFAULT_KEYS = COLUMNS.map((column) => column.key);

function loadSelection(): string[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [...DEFAULT_KEYS];
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_KEYS];
    // Drop anything that no longer exists so a stale choice cannot break the file.
    const valid = parsed.filter((key): key is string =>
      DEFAULT_KEYS.includes(key as (typeof DEFAULT_KEYS)[number]),
    );
    return valid.length > 0 ? valid : [...DEFAULT_KEYS];
  } catch {
    return [...DEFAULT_KEYS];
  }
}

/**
 * Downloads submitted entries as a spreadsheet file.
 *
 * Needs nothing from Google: no service account, no external sharing, no
 * configuration. The file opens in Sheets or Excel directly.
 */
export function ExportCsv({
  weekStart,
  market,
  department,
}: {
  weekStart: string;
  /** "all", or a market to restrict the file to. Mirrors the page filters. */
  market: string;
  department: string;
}) {
  const [busy, setBusy] = useState<"week" | "month" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(DEFAULT_KEYS);

  // Read on mount rather than during render, so the server and the first
  // client paint agree.
  useEffect(() => setSelected(loadSelection()), []);

  const persist = (keys: string[]) => {
    setSelected(keys);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    } catch {
      /* storage unavailable; the choice simply will not persist */
    }
  };

  const toggle = (key: string) => {
    const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
    // Never let the file end up with no columns at all.
    if (next.length > 0) persist(next);
  };

  const columns = useMemo(
    () => COLUMNS.filter((column) => selected.includes(column.key)),
    [selected],
  );

  const filtersApplied = market !== "all" || department !== "all";

  const run = async (scope: "week" | "month") => {
    if (busy) return;
    setBusy(scope);
    setError(null);
    setNote(null);

    const anchor = parseDateKey(weekStart);
    const from = scope === "week" ? weekStart : toDateKey(startOfMonth(anchor));
    const to = scope === "week" ? weekEnd(weekStart) : toDateKey(endOfMonth(anchor));

    try {
      const all = await fetchExportRows(from, to);
      // The file matches what the page is showing, rather than silently
      // including markets and departments that were filtered out.
      const rows = all.filter(
        (row) =>
          (market === "all" || row.market === (market as Market)) &&
          (department === "all" || row.department === department),
      );

      if (rows.length === 0) {
        setNote(
          filtersApplied
            ? "Nothing submitted for that period and filter."
            : "Nothing submitted in that period yet.",
        );
        return;
      }

      const label = scope === "week" ? `${from}_to_${to}` : format(anchor, "yyyy-MM");
      const suffix = market === "all" ? "" : `_${market}`;
      downloadCsv(
        `kijamii-timesheets_${label}${suffix}.csv`,
        toCsv(
          columns.map((column) => column.key),
          rows.map((row) => columns.map((column) => column.value(row))),
        ),
      );
      setNote(`${rows.length} row${rows.length === 1 ? "" : "s"} downloaded.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            Columns
            <span className="num text-[11px] text-muted-foreground">
              {selected.length}/{COLUMNS.length}
            </span>
            <ChevronDown className="size-3.5 opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1.5">
          <p className="label-xs px-2 py-1.5">Include in the file</p>
          <div className="max-h-[280px] overflow-y-auto">
            {COLUMNS.map((column) => {
              const on = selected.includes(column.key);
              return (
                <button
                  key={column.key}
                  type="button"
                  onClick={() => toggle(column.key)}
                  aria-pressed={on}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-surface-muted"
                >
                  <Check className={cn("size-3.5 shrink-0", on ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{column.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => persist([...DEFAULT_KEYS])}
            className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-surface-muted"
          >
            Select all
          </button>
        </PopoverContent>
      </Popover>

      <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void run("week")}>
        {busy === "week" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        Export week
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={busy !== null}
        onClick={() => void run("month")}
      >
        {busy === "month" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        Export month
      </Button>

      {note && <span className="text-[12px] text-muted-foreground">{note}</span>}
      {error && (
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-destructive">
          <AlertCircle className="size-3.5" /> {error}
        </span>
      )}
    </div>
  );
}
