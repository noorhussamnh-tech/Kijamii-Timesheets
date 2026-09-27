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

/**
 * How much of a period somebody has actually filed.
 *
 * Three buckets, because that is how the question is asked when a lead is
 * chasing: done, started, not started. The line between the last two is at
 * half, so somebody who logged one day of five is not sitting in the same
 * bucket as somebody who logged four.
 *
 * Measured on filed hours against the hours the period expects -- not on
 * days covered, and not including drafts. A draft is a sentence somebody has
 * not finished; counting it as filled would mean the page says "done" about
 * work nobody has actually handed in, which is the one thing a chase list
 * must never do.
 */
export type FillLevel = "full" | "partial" | "none";

export function fillLevel(hours: number, expected: number): FillLevel {
  // A range with no working days in it expects nothing, so anything at all is
  // everything, and nothing is not a failure to do anything.
  if (expected <= 0) return hours > 0 ? "full" : "none";
  const share = hours / expected;
  if (share >= 1) return "full";
  return share >= 0.5 ? "partial" : "none";
}

/** The share of the period filed, as a whole number, for a label. */
export function fillPercent(hours: number, expected: number): number {
  if (expected <= 0) return hours > 0 ? 100 : 0;
  return Math.round((hours / expected) * 100);
}
