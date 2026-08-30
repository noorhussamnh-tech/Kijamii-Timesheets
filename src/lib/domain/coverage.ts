/**
 * Which days of a month still have nothing logged against them.
 *
 * More useful than a streak: a streak tells you how you are doing, a list of
 * gaps tells you what to do next. Non-working days are excluded entirely --
 * Friday and Saturday are the weekend in Egypt and Saudi Arabia, so counting
 * them as "missing" would be noise, not information.
 */
import { addDays, isSameMonth, startOfMonth } from "date-fns";

import { parseDateKey, toDateKey } from "./week";

export interface DayCoverage {
  date: string;
  hours: number;
}

export interface MonthCoverage {
  /** Working days in the month up to today, with nothing logged. */
  missing: string[];
  /** Working days up to today that do have hours. */
  logged: string[];
  /** Working days so far this month, whether logged or not. */
  workingDaysSoFar: number;
  /** 0 to 1. One means every working day so far has something on it. */
  completion: number;
}

/**
 * @param month     Any date inside the month of interest.
 * @param days      Hours already logged, by date.
 * @param workDays  Day-of-week numbers that count as working days, 0 = Sunday.
 * @param today     Days after this are not yet missing -- they have not happened.
 */
export function monthCoverage(
  month: Date,
  days: DayCoverage[],
  workDays: number[],
  today: Date = new Date(),
): MonthCoverage {
  const logged = new Set(days.filter((day) => day.hours > 0).map((day) => day.date));
  const todayKey = toDateKey(today);

  const missing: string[] = [];
  const filled: string[] = [];

  let cursor = startOfMonth(month);
  while (isSameMonth(cursor, month)) {
    const key = toDateKey(cursor);
    // A day that has not arrived yet cannot be missing.
    if (key > todayKey) break;

    if (workDays.includes(cursor.getDay())) {
      if (logged.has(key)) filled.push(key);
      else missing.push(key);
    }
    cursor = addDays(cursor, 1);
  }

  const workingDaysSoFar = missing.length + filled.length;
  return {
    missing,
    logged: filled,
    workingDaysSoFar,
    completion: workingDaysSoFar === 0 ? 1 : filled.length / workingDaysSoFar,
  };
}

/** Groups missing days into "24, 25 and 26 Aug" style runs for display. */
export function describeMissing(missing: string[], limit = 4): string {
  if (missing.length === 0) return "";
  const shown = missing.slice(-limit).map((key) => {
    const date = parseDateKey(key);
    return String(date.getDate());
  });
  const monthName = parseDateKey(missing[missing.length - 1]!).toLocaleString("en", {
    month: "short",
  });

  if (shown.length === 1) return `${shown[0]} ${monthName}`;
  const last = shown.pop();
  return `${shown.join(", ")} and ${last} ${monthName}`;
}
