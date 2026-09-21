import { useState } from "react";
import { AlertCircle, ChevronDown, Download, Loader2 } from "lucide-react";

import { EXPORT_TRIGGER } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchTimeDedicationRows } from "@/lib/data/api";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import { toLongRows, toWideRows } from "@/lib/export/time-dedication";

/** How far back the year picker offers. Nothing exists before the app did. */
const FIRST_YEAR = 2026;

function years(): number[] {
  const now = new Date().getFullYear();
  const list: number[] = [];
  for (let year = Math.max(now, FIRST_YEAR); year >= FIRST_YEAR; year -= 1) list.push(year);
  return list;
}

/**
 * A calendar year at a glance, and the feed for the job book's "Egypt & UAE
 * Time Dedication" tab.
 *
 * Called "Time dedication" until the name was questioned, correctly: it read
 * as an analysis when it is a file shape for one destination, and it gave no
 * hint that it is the only export here that ignores the toolbar's date range
 * in favour of a whole calendar year. The tab it feeds keeps its own name;
 * this control is named for what somebody choosing it is actually choosing.
 *
 * Two shapes, because the tab is read two ways. "Matching the sheet" is wide,
 * a column per month, to paste in. "For lookups" is long, one row per person,
 * brand and month, carrying a key formulas can match on so the numbers update
 * without anybody retyping them.
 *
 * Everybody, in one file. It used to open on Egypt & UAE with a picker for
 * the other entities; the company is not being run by market at this stage,
 * so the file is not cut by one either.
 */
export function ExportTimeDedication() {
  const [year, setYear] = useState(() => String(Math.max(new Date().getFullYear(), FIRST_YEAR)));
  const [busy, setBusy] = useState<"wide" | "long" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (shape: "wide" | "long") => {
    if (busy) return;
    setBusy(shape);
    setError(null);
    setNote(null);

    const value = Number(year);
    try {
      const rows = await fetchTimeDedicationRows(`${value}-01-01`, `${value}-12-31`);
      const shaped = shape === "wide" ? toWideRows(rows, value) : toLongRows(rows);

      if (shaped.rows.length === 0) {
        setNote("Nobody to export yet.");
        return;
      }

      downloadCsv(
        `kijamii-calendar-year_${value}_${shape === "wide" ? "sheet" : "lookup"}.csv`,
        toCsv(shaped.headers, shaped.rows),
      );
      setNote(`${shaped.rows.length} row${shaped.rows.length === 1 ? "" : "s"} downloaded.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" className={EXPORT_TRIGGER}>
          Calendar Year View
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] space-y-3 p-3">
        <div className="space-y-1">
          <p className="label-xs">Calendar Year View</p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            A whole year, a column per month, by person and brand — the shape the agency job book
            expects. Everyone appears, including anyone who logged nothing.
          </p>
          {/* The one control here that does not read the toolbar's dates, which
              is worth saying where somebody is looking rather than leaving
              them to notice the file covers a different period. */}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Covers the year chosen below, not the dates in the toolbar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="label-xs-muted w-12 shrink-0">Year</span>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-8 w-[110px] text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years().map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            disabled={busy !== null}
            onClick={() => void run("wide")}
          >
            {busy === "wide" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Matching the sheet
          </Button>
          <p className="px-1 text-[11px] text-muted-foreground">
            A column per month, ready to paste into the tab.
          </p>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            disabled={busy !== null}
            onClick={() => void run("long")}
          >
            {busy === "long" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            For lookups
          </Button>
          <p className="px-1 text-[11px] text-muted-foreground">
            One row per month with a key to point <span className="num">VLOOKUP</span> at.
          </p>
        </div>

        {note && <p className="text-[12px] text-muted-foreground">{note}</p>}
        {error && (
          <p className="inline-flex items-start gap-1 text-[12px] font-medium text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
