import { addDays, format } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatHours } from "@/lib/domain/totals";
import { parseDateKey, toDateKey } from "@/lib/domain/week";
import { useTimesheet } from "@/lib/timesheet-store";

/**
 * Which day you are filling in.
 *
 * A week range used to sit here -- "27 Sep – 3 Oct" -- which named the unit
 * the app submits in rather than the unit anybody works in. Nobody thinks "I
 * must do week 40"; they think "I never did Tuesday". So the heading is the
 * day, and the arrows step a day at a time, across a week boundary without
 * saying so, because a Sunday and the Saturday before it are one day apart
 * and the fact that they submit separately is not the filler's problem.
 */
export function DayNav() {
  const { focusDate, setDay, totals } = useTimesheet();

  const day = parseDateKey(focusDate);
  const today = toDateKey(new Date());
  const onToday = focusDate === today;
  const hours = totals.byDay.find((entry) => entry.date === focusDate)?.hours ?? 0;

  const step = (delta: number) => setDay(toDateKey(addDays(day, delta)));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-surface px-3 py-2.5 shadow-card">
      <Button
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        aria-label="Previous day"
        onClick={() => step(-1)}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <div className="min-w-0">
        <p className="num truncate text-[15px] font-bold">{format(day, "EEEE d MMMM")}</p>
        <p className="text-[11px] text-muted-foreground">
          {onToday ? "Today" : format(day, "yyyy")}
          {hours > 0 && <span className="num"> · {formatHours(hours)} logged</span>}
        </p>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        aria-label="Next day"
        onClick={() => step(1)}
      >
        <ChevronRight className="size-4" />
      </Button>

      {!onToday && (
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-8 gap-1.5"
          onClick={() => setDay(today)}
        >
          <CalendarDays className="size-3.5" /> Today
        </Button>
      )}
    </div>
  );
}
