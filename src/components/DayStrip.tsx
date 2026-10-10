import { format } from "date-fns";

import type { RecentDay } from "@/lib/domain/coverage";
import { parseDateKey } from "@/lib/domain/week";
import { useTimesheet } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

/**
 * The last thirty days, and what is on each of them.
 *
 * This is how a day gets chosen, and it is the whole reason the week could
 * stop being the unit: the way back to a day you missed three weeks ago is to
 * see it and click it, not to press a back arrow nineteen times.
 *
 * What each cell says is deliberately thin -- the date and the hours. A day
 * with hours on it is filled in; a working day without is the thing to do
 * next; a weekend without is nothing at all. Three states, three weights, no
 * legend required.
 */
export function DayStrip({ days }: { days: RecentDay[] | null }) {
  const { focusDate, setDay } = useTimesheet();

  if (!days || days.length === 0) return null;

  const missing = days.filter((day) => day.isWorkingDay && day.hours === 0 && !day.isToday).length;

  return (
    <section className="rounded-lg border bg-surface px-3 py-2.5 shadow-card">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="label-xs">Last 30 days</p>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {missing === 0 ? (
            <span className="font-semibold text-success">Nothing outstanding</span>
          ) : (
            <>
              <span className="num font-semibold text-warning">{missing}</span> working{" "}
              {missing === 1 ? "day" : "days"} with nothing on {missing === 1 ? "it" : "them"}
            </>
          )}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {days.map((day) => {
          const date = parseDateKey(day.date);
          const filled = day.hours > 0;
          const owed = day.isWorkingDay && !filled && !day.isToday;
          const current = day.date === focusDate;

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => setDay(day.date)}
              aria-current={current ? "date" : undefined}
              title={`${format(date, "EEEE d MMMM")}${filled ? ` · ${day.hours}h` : " · nothing logged"}`}
              className={cn(
                "num flex w-[46px] flex-col items-center rounded-md border px-1 py-1 text-[10px] leading-tight transition-colors",
                filled && "border-success/30 bg-success-soft text-success hover:border-success",
                owed && "border-warning/30 bg-warning-soft text-warning hover:border-warning",
                !filled && !owed && "border-transparent bg-surface-muted text-muted-foreground",
                // The day you are on outranks what is on it: this is a picker,
                // and a picker that does not say where you are is a list.
                current && "ring-2 ring-ring ring-offset-1 ring-offset-surface",
              )}
            >
              <span className="font-semibold">{format(date, "EEE")}</span>
              <span className="text-[12px] font-bold">{format(date, "d")}</span>
              <span className="opacity-80">{filled ? `${day.hours}h` : "–"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
