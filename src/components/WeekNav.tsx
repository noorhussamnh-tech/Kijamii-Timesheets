import { ChevronLeft, ChevronRight, CopyPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimesheet } from "@/lib/timesheet-store";
import {
  MAX_ENTRY_DATE,
  MIN_ENTRY_DATE,
  weekKeyOf,
  weekNumberLabel,
  weekRangeLabel,
} from "@/data/weeks";

export function WeekNav() {
  const { weekKey, goWeek, goCurrentWeek, copyPreviousWeek, setWeekKey, readOnly } = useTimesheet();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface p-2.5 shadow-card">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => goWeek(-1)} aria-label="Previous week">
          <ChevronLeft className="size-4" />
        </Button>
        <div className="min-w-0 px-1">
          <p className="num truncate text-[13px] font-semibold">{weekRangeLabel(weekKey)}</p>
          <p className="truncate text-[11px] text-muted-foreground">{weekNumberLabel(weekKey)}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => goWeek(1)} aria-label="Next week">
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={goCurrentWeek}>
          Current week
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Jump to date
          <input
            type="date"
            min={MIN_ENTRY_DATE}
            max={MAX_ENTRY_DATE}
            value={weekKey}
            onChange={(e) => {
              const v = e.target.value;
              if (!v || v > MAX_ENTRY_DATE || v < MIN_ENTRY_DATE) return;
              const [y, m, d] = v.split("-").map(Number);
              setWeekKey(weekKeyOf(new Date(y!, (m ?? 1) - 1, d ?? 1)));
            }}
            className="num rounded-md border bg-surface px-2 py-1 text-[12px] font-medium text-foreground focus:outline-2 focus:outline-ring"
          />
        </label>
        <Button variant="outline" size="sm" onClick={copyPreviousWeek} disabled={readOnly}>
          <CopyPlus className="size-3.5" /> Copy previous week
        </Button>
      </div>
    </div>
  );
}

