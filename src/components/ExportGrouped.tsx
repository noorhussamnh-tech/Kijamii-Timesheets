import { useState } from "react";
import { AlertCircle, ChevronDown, Download, Loader2 } from "lucide-react";

import { EXPORT_TRIGGER } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchEmployeeDetail } from "@/lib/data/api";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import { VIEW_GROUPS, type ExportView } from "@/lib/export/views";
import { cn } from "@/lib/utils";

/**
 * Everybody's hours over the chosen period, grouped however the question
 * needs them.
 *
 * This replaces the per-person panel that used to sit beside it. Once that
 * panel's employee picker went -- redundant, because every row of the table
 * has its own Export button, which is the better door for one person since
 * you click the name you are already looking at -- the two controls made the
 * same call with the same views and the same filters. Two buttons doing one
 * thing is worse than either of them.
 *
 * What the panel had and this did not, it has now: a line under each view
 * saying what the file contains, and a count of how many people are actually
 * in it.
 */
export function ExportGrouped({
  from,
  to,
  market,
  department,
}: {
  from: string;
  to: string;
  /** The page's own filters. "all" means unfiltered. */
  market: string;
  department: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (view: ExportView) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      const data = await fetchEmployeeDetail(from, to, null);

      // The file matches what the page is showing rather than quietly
      // including the markets and departments that were filtered out.
      const narrowed = {
        ...data,
        employees: data.employees.filter(
          (person) =>
            (market === "all" || person.primaryMarket === market) &&
            (department === "all" || person.department === department),
        ),
        rows: data.rows.filter(
          (row) =>
            (market === "all" || row.market === market) &&
            (department === "all" || row.department === department),
        ),
      };

      const shaped = view.shape(narrowed);
      if (shaped.rows.length === 0) {
        setNote("Nothing submitted in that period.");
        return;
      }

      downloadCsv(`kijamii_${view.id}_${from}_to_${to}.csv`, toCsv(shaped.headers, shaped.rows));
      setNote(`${shaped.rows.length} row${shaped.rows.length === 1 ? "" : "s"} downloaded.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className={EXPORT_TRIGGER} disabled={busy}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export By
            <ChevronDown className="size-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {VIEW_GROUPS.map((group, index) => (
            <div key={group.label}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="label-xs">{group.label}</DropdownMenuLabel>
              {group.views.map((view) => (
                <DropdownMenuItem
                  key={view.id}
                  onClick={() => void run(view)}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="font-medium">{view.label}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    {view.note}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          ))}
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
