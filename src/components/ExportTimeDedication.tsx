import { useState } from "react";
import { AlertCircle, ChevronDown, Download, Loader2 } from "lucide-react";

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
import type { Market } from "@/lib/domain/types";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import { toLongRows, toWideRows } from "@/lib/export/time-dedication";

/** How far back the year picker offers. Nothing exists before the app did. */
const FIRST_YEAR = 2026;

/**
 * Which markets the file covers.
 *
 * Egypt and the UAE lead because that is the job book tab this feeds. Saudi
 * used to be excluded in code, on the understanding that it kept no
 * timesheets -- it does now, and a rule in code cannot notice that changing,
 * where a choice on screen can.
 */
const MARKET_SETS: { id: string; label: string; markets: Market[]; note: string }[] = [
  {
    id: "eg-uae",
    label: "Egypt & UAE",
    markets: ["EG", "UAE"],
    note: "The job book tab.",
  },
  { id: "ksa", label: "Saudi only", markets: ["KSA"], note: "KSA hours on their own." },
  { id: "all", label: "Every market", markets: [], note: "Everyone, everywhere." },
];

function years(): number[] {
  const now = new Date().getFullYear();
  const list: number[] = [];
  for (let year = Math.max(now, FIRST_YEAR); year >= FIRST_YEAR; year -= 1) list.push(year);
  return list;
}

/**
 * The feed for the job book's "Egypt & UAE Time Dedication" tab.
 *
 * Two shapes, because the tab is read two ways. "Matching the sheet" is wide,
 * a column per month, to paste in. "For lookups" is long, one row per person,
 * brand and month, carrying a key formulas can match on so the numbers update
 * without anybody retyping them.
 *
 * KSA is absent by design: that market keeps no timesheets, so it has no tab.
 */
export function ExportTimeDedication() {
  const [year, setYear] = useState(() => String(Math.max(new Date().getFullYear(), FIRST_YEAR)));
  const [marketSet, setMarketSet] = useState("eg-uae");
  const [busy, setBusy] = useState<"wide" | "long" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (shape: "wide" | "long") => {
    if (busy) return;
    setBusy(shape);
    setError(null);
    setNote(null);

    const value = Number(year);
    const chosen = MARKET_SETS.find((set) => set.id === marketSet) ?? MARKET_SETS[0]!;
    try {
      const rows = await fetchTimeDedicationRows(
        `${value}-01-01`,
        `${value}-12-31`,
        chosen.markets,
      );
      const shaped = shape === "wide" ? toWideRows(rows, value) : toLongRows(rows);

      if (shaped.rows.length === 0) {
        setNote(`No ${chosen.label.toLowerCase()} employees to export yet.`);
        return;
      }

      downloadCsv(
        `kijamii-time-dedication_${value}_${chosen.id}_${shape === "wide" ? "sheet" : "lookup"}.csv`,
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
        <Button variant="outline" size="sm" className="gap-1.5">
          Time dedication
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] space-y-3 p-3">
        <div className="space-y-1">
          <p className="label-xs">Egypt &amp; UAE time dedication</p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Hours by person, brand and month, for the agency job book. Everyone in the chosen
            markets appears, including anyone who logged nothing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="label-xs-muted w-12 shrink-0">Markets</span>
          <Select value={marketSet} onValueChange={setMarketSet}>
            <SelectTrigger className="h-8 flex-1 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MARKET_SETS.map((set) => (
                <SelectItem key={set.id} value={set.id}>
                  {set.label}
                  <span className="ml-2 text-[11px] text-muted-foreground">{set.note}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
