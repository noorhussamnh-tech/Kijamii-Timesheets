/** Hours arithmetic for the summary bar and the submission confirmation. */
import { weekDates } from "./week";
import type { TimesheetConfig } from "./config";
import type { TimesheetEntry } from "./types";

export interface DayTotal {
  date: string;
  hours: number;
  expected: number;
  isWorkingDay: boolean;
}

export interface WeekTotals {
  total: number;
  billable: number;
  nonBillable: number;
  expected: number;
  /** Hours still to log. Zero once the target is met. */
  missing: number;
  /** Hours logged beyond the target. Zero when under. */
  excess: number;
  byDay: DayTotal[];
}

function hoursOf(entry: TimesheetEntry): number {
  return typeof entry.hours === "number" && Number.isFinite(entry.hours) ? entry.hours : 0;
}

/** Rounds to two decimals so repeated 0.25 additions do not drift. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateTotals(
  entries: TimesheetEntry[],
  weekStart: string,
  config: TimesheetConfig,
  expectedWeeklyHours: number,
): WeekTotals {
  let total = 0;
  let billable = 0;
  for (const entry of entries) {
    const hours = hoursOf(entry);
    total += hours;
    if (entry.billable) billable += hours;
  }
  total = round(total);
  billable = round(billable);

  const workingDays = config.workDays.length || 1;
  const perWorkingDay = round(expectedWeeklyHours / workingDays);

  const byDay: DayTotal[] = weekDates(weekStart).map((date, index) => {
    const isWorkingDay = config.workDays.includes(index);
    return {
      date,
      hours: round(
        entries.filter((e) => e.workDate === date).reduce((sum, e) => sum + hoursOf(e), 0),
      ),
      expected: isWorkingDay ? perWorkingDay : 0,
      isWorkingDay,
    };
  });

  return {
    total,
    billable,
    nonBillable: round(total - billable),
    expected: expectedWeeklyHours,
    missing: round(Math.max(expectedWeeklyHours - total, 0)),
    excess: round(Math.max(total - expectedWeeklyHours, 0)),
    byDay,
  };
}

/** Formats hours for display: 4 stays "4h", 4.25 becomes "4.25h". */
export function formatHours(value: number): string {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(2))}h`;
}
