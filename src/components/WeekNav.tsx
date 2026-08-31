import { ChevronLeft, ChevronRight, CopyPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTimesheet } from "@/lib/timesheet-store";
import { currentWeekKey, weekKeyOf, weekNumberLabel, weekRangeLabel } from "@/lib/domain/week";

export function WeekNav() {
  const { weekKey, goWeek, goCurrentWeek, copyPreviousWeek, setWeekKey } = useTimesheet();

  const thisWeek = currentWeekKey();
  const atCurrentWeek = weekKey === thisWeek;

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
        <Button variant="ghost" size="sm" onClick={goCurrentWeek} disabled={atCurrentWeek}>
          Current week
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Jump to date
          <input
            type="date"
            value={weekKey}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              const [year, month, day] = value.split("-").map(Number);
              if (!year || !month || !day) return;
              setWeekKey(weekKeyOf(new Date(year, month - 1, day)));
            }}
            className="num rounded-md border bg-surface px-2 py-1 text-[12px] font-medium text-foreground focus:outline-2 focus:outline-ring"
          />
        </label>
        <Button variant="outline" size="sm" onClick={() => void copyPreviousWeek()}>
          <CopyPlus className="size-3.5" /> Copy previous week
        </Button>
      </div>
    </div>
  );
}
