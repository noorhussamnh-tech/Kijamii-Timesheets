import { useState } from "react";
import { AlertCircle, ChevronDown, Download, Loader2 } from "lucide-react";
import { endOfMonth, format, startOfMonth } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchExportRows, type ExportRow } from "@/lib/data/api";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import { parseDateKey, toDateKey, weekEnd, weekRangeLabel } from "@/lib/domain/week";
import type { Market } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/** The columns of the file, in order. */
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
    key: "work_type",
    label: "Work type",
    // Rows logged before the column existed carry nothing, and are left blank
    // rather than guessed into the more common answer.
    value: (r: ExportRow) =>
      r.workType === "amend" ? "Amend" : r.workType === "new_task" ? "New Task" : "",
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

  /*
   * Every column, always.
   *
   * There used to be a picker here, remembering a choice in localStorage. It
   * was a setting on a file somebody opens in a spreadsheet and then hides
   * the columns they do not want -- which they can do anyway, and which does
   * not silently produce a file missing a column the next person needed
   * because of a choice made months ago in a different browser.
   */
  const columns = COLUMNS;

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
    /*
     * The result is written underneath the button rather than beside it.
     * Beside it, "5 rows downloaded" grew the row by its own width and shoved
     * every control to its right along -- so the act of exporting rearranged
     * the toolbar you were about to use again.
     */
    <div className="relative">
      {/* One control, because the two buttons were the same action with a
          different range and read as two unrelated exports. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy !== null}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export period
            <ChevronDown className="size-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="label-xs">Every entry, as a file</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => void run("week")}>
            This week
            <span className="num ml-auto text-[11px] text-muted-foreground">
              {weekRangeLabel(weekStart)}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void run("month")}>
            This month
            <span className="num ml-auto text-[11px] text-muted-foreground">
              {format(parseDateKey(weekStart), "MMM yyyy")}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {(note ?? error) && (
        <span
          className={cn(
            "absolute top-full left-0 mt-0.5 inline-flex items-center gap-1 leading-none whitespace-nowrap text-[11px]",
            error ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {error && <AlertCircle className="size-3" />}
          {error ?? note}
        </span>
      )}
    </div>
  );
}
