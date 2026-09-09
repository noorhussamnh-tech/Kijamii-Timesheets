import { useState } from "react";
import { subDays, addDays } from "date-fns";
import { AlertCircle, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchEmployeeDetail, type EmployeeDetailExport } from "@/lib/data/api";
import { toDateKey } from "@/lib/domain/week";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import { perClientView, perDayView, perMonthView, perWeekView } from "@/lib/export/employee-detail";

/**
 * The four ways one person's time can be read.
 *
 * Every one folds the same fetched rows rather than running its own query, so
 * the monthly total and the daily totals underneath it cannot disagree.
 */
const GROUPINGS = [
  { id: "day", label: "By day", shape: (d: EmployeeDetailExport) => perDayView(d.rows) },
  { id: "week", label: "By week", shape: (d: EmployeeDetailExport) => perWeekView(d.rows) },
  { id: "month", label: "By month", shape: (d: EmployeeDetailExport) => perMonthView(d.rows) },
  { id: "client", label: "By client", shape: (d: EmployeeDetailExport) => perClientView(d.rows) },
] as const;

/**
 * Everything this person has logged, however you want it grouped.
 *
 * Deliberately not tied to the week the page above is showing. The table is a
 * chase list for one week; this is the whole record, which is the question
 * somebody asks when they click a name rather than scan a column.
 *
 * The window is the widest the export function accepts, which reaches further
 * back than this app has existed. It is bounded rather than open because an
 * unbounded range would eventually be a slow query nobody had thought about,
 * and it runs a month into the future because a week ahead of today can be
 * filled in.
 */
export function EmployeeExportMenu({ employeeId, name }: { employeeId: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (grouping: (typeof GROUPINGS)[number]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const today = new Date();
      const data = await fetchEmployeeDetail(
        toDateKey(subDays(today, 760)),
        toDateKey(addDays(today, 30)),
        employeeId,
      );
      const shaped = grouping.shape(data);

      if (shaped.rows.length === 0) {
        // "Submitted", not "logged". Drafts are deliberately absent from every
        // export, so somebody mid-week with a full timesheet still exports
        // nothing -- and being told they had logged nothing would be wrong.
        setNote("Nothing submitted yet.");
        return;
      }

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      downloadCsv(`kijamii-${slug}_by-${grouping.id}.csv`, toCsv(shaped.headers, shaped.rows));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Said next to the button that caused it. A row in a table of a hundred
          is the wrong place to look for a message at the top of the page. */}
      {note && <span className="text-[11px] whitespace-nowrap text-muted-foreground">{note}</span>}
      {error && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
          <AlertCircle className="size-3" /> {error}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={busy}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="label-xs">
            Group {name.split(" ")[0]}&apos;s hours
          </DropdownMenuLabel>
          {GROUPINGS.map((grouping) => (
            <DropdownMenuItem key={grouping.id} onClick={() => void run(grouping)}>
              {grouping.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
