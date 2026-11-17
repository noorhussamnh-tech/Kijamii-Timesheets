import { useState } from "react";
import { AlertCircle, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchEmployeeDetail, type EmployeeDetailExport, type ReadScope } from "@/lib/data/api";
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
 * One person's time over the period on screen, however you want it grouped.
 *
 * This used to ignore the toolbar and always pull the widest window the export
 * function accepts -- today less 760 days to today plus 30 -- on the argument
 * that clicking a name asks for the whole record rather than the week being
 * scanned. That argument held while the page showed a single week. It stopped
 * holding when the page grew a date range, and it cost us: an export taken
 * against "1 - 31 October" returned October and November, the November figure
 * was read as a contradiction of the October one, and the file carried no
 * dates to settle it.
 *
 * So the period is now the one the toolbar is showing, the same period every
 * other export on this screen uses and the same one the numbers in the row
 * beside this button are counted over. The range is in the filename too, so a
 * file that has been sitting in somebody's downloads folder still says what it
 * covers.
 */
export function EmployeeExportMenu({
  employeeId,
  name,
  from,
  to,
  scope = "company",
}: {
  employeeId: string;
  name: string;
  /** The period on screen. The same `from` and `to` the table is counted over. */
  from: string;
  to: string;
  /** Whose rows the file may be drawn from. The database enforces it. */
  scope?: ReadScope;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (grouping: (typeof GROUPINGS)[number]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const data = await fetchEmployeeDetail(from, to, employeeId, scope);
      const shaped = grouping.shape(data);

      if (shaped.rows.length === 0) {
        // "Submitted", not "logged". Drafts are deliberately absent from every
        // export, so somebody mid-week with a full timesheet still exports
        // nothing -- and being told they had logged nothing would be wrong.
        // Says "in this period" because the period is now the toolbar's: an
        // empty file is a question about the dates as often as about the person.
        setNote("Nothing submitted in this period.");
        return;
      }

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      downloadCsv(
        `kijamii-${slug}_by-${grouping.id}_${from}_to_${to}.csv`,
        toCsv(shaped.headers, shaped.rows),
      );
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
