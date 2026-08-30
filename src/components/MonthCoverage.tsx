import { useEffect, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { CalendarX2, Check } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { fetchMyLoggedDays } from "@/lib/data/api";
import { monthCoverage, type DayCoverage } from "@/lib/domain/coverage";
import { parseDateKey, toDateKey, weekKeyOf } from "@/lib/domain/week";
import { useTimesheet } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

/**
 * Which working days this month still have nothing on them.
 *
 * More actionable than a streak: a streak reports how you are doing, this says
 * what to do next. Friday and Saturday never appear -- they are the weekend in
 * both Egypt and Saudi Arabia, so counting them as gaps would be noise.
 */
export function MonthCoverage() {
  const { status: authStatus } = useAuth();
  const { config, setWeekKey, addDay, weekKey } = useTimesheet();
  const [days, setDays] = useState<DayCoverage[] | null>(null);

  const month = new Date();

  useEffect(() => {
    if (authStatus !== "ready") return;
    let cancelled = false;

    void fetchMyLoggedDays(toDateKey(startOfMonth(month)), toDateKey(endOfMonth(month)))
      .then((rows) => {
        if (!cancelled) setDays(rows);
      })
      .catch(() => {
        // A failed strip should not take the timesheet down with it.
        if (!cancelled) setDays([]);
      });

    return () => {
      cancelled = true;
    };
    // Re-read after the week changes, so submitting a day updates the strip.
  }, [authStatus, weekKey]);

  if (!days) return null;

  const coverage = monthCoverage(month, days, config.workDays);
  if (coverage.workingDaysSoFar === 0) return null;

  const complete = coverage.missing.length === 0;

  const jumpTo = (date: string) => {
    setWeekKey(weekKeyOf(parseDateKey(date)));
    addDay(date);
  };

  return (
    <section className="rounded-lg border bg-surface px-3 py-2.5 shadow-card">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {complete ? (
          <>
            <Check className="size-3.5 shrink-0 text-success" />
            <p className="text-[12px] font-semibold text-success">
              Every working day in {format(month, "MMMM")} is logged.
            </p>
          </>
        ) : (
          <>
            <CalendarX2 className="size-3.5 shrink-0 text-warning" />
            <p className="text-[12px]">
              <span className="font-semibold">
                {coverage.missing.length} day{coverage.missing.length === 1 ? "" : "s"}
              </span>{" "}
              <span className="text-muted-foreground">still empty in {format(month, "MMMM")}</span>
            </p>
          </>
        )}
        <span className="num ml-auto text-[11px] text-muted-foreground">
          {coverage.logged.length}/{coverage.workingDaysSoFar} working days
        </span>
      </div>

      {!complete && (
        <div className="mt-2 flex flex-wrap gap-1">
          {coverage.missing.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => jumpTo(date)}
              title={`Go to ${format(parseDateKey(date), "EEEE d MMMM")}`}
              className={cn(
                "num rounded-md border border-warning/30 bg-warning-soft px-2 py-0.5",
                "text-[11px] font-semibold text-warning transition-colors hover:border-warning",
              )}
            >
              {format(parseDateKey(date), "EEE d")}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
