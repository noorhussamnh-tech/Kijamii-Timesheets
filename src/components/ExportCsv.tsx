import { useState } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { endOfMonth, format, startOfMonth } from "date-fns";

import { Button } from "@/components/ui/button";
import { fetchExportRows, type ExportRow } from "@/lib/data/api";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import { parseDateKey, toDateKey, weekEnd } from "@/lib/domain/week";

const HEADERS = [
  "work_date",
  "employee_name",
  "employee_email",
  "market",
  "department",
  "client_name",
  "service_name",
  "project_type",
  "task_description",
  "hours",
  "billing_type",
  "notes",
  "week_start",
  "status",
  "submitted_at",
] as const;

function toRow(entry: ExportRow): unknown[] {
  return [
    entry.workDate,
    entry.employeeName,
    entry.employeeEmail,
    entry.market,
    entry.department,
    entry.clientName,
    entry.serviceName,
    entry.projectType,
    entry.taskDescription,
    Number(entry.hours),
    entry.billable ? "Billable" : "Non-billable",
    entry.notes,
    entry.weekStart,
    entry.status,
    entry.submittedAt,
  ];
}

/**
 * Downloads submitted entries as a spreadsheet file.
 *
 * Deliberately has no dependency on Google: no service account, no external
 * sharing, nothing to configure. The file opens in Sheets or Excel directly.
 */
export function ExportCsv({ weekStart }: { weekStart: string }) {
  const [busy, setBusy] = useState<"week" | "month" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (scope: "week" | "month") => {
    if (busy) return;
    setBusy(scope);
    setError(null);
    setNote(null);

    const anchor = parseDateKey(weekStart);
    const from = scope === "week" ? weekStart : toDateKey(startOfMonth(anchor));
    const to = scope === "week" ? weekEnd(weekStart) : toDateKey(endOfMonth(anchor));

    try {
      const rows = await fetchExportRows(from, to);
      if (rows.length === 0) {
        setNote("Nothing submitted in that period yet.");
        return;
      }
      const label = scope === "week" ? `${from}_to_${to}` : format(anchor, "yyyy-MM");
      downloadCsv(`kijamii-timesheets_${label}.csv`, toCsv(HEADERS, rows.map(toRow)));
      setNote(`${rows.length} row${rows.length === 1 ? "" : "s"} downloaded.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
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
