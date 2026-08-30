/**
 * Week arithmetic.
 *
 * Weeks are Sunday-anchored in every market, matching the `week_start` column
 * and the `extract(dow) = 0` constraint in the database. A week is identified
 * everywhere by its Sunday as a `yyyy-MM-dd` string, which keeps keys stable
 * across time zones -- a `Date` would shift under a UTC-behind offset.
 */
import { addDays, format, parse, startOfWeek } from "date-fns";

export type WeekKey = string;

export const WEEK_STARTS_ON = 0 as const;

/** Parses a `yyyy-MM-dd` string as a local calendar date, never as UTC. */
export function parseDateKey(key: string): Date {
  return parse(key, "yyyy-MM-dd", new Date());
}

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function weekKeyOf(date: Date): WeekKey {
  return toDateKey(startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }));
}

export function currentWeekKey(today: Date = new Date()): WeekKey {
  return weekKeyOf(today);
}

/** The seven dates of a week, Sunday first. */
export function weekDates(week: WeekKey): string[] {
  const start = parseDateKey(week);
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)));
}

export function weekEnd(week: WeekKey): string {
  return toDateKey(addDays(parseDateKey(week), 6));
}

export function shiftWeek(week: WeekKey, byWeeks: number): WeekKey {
  return weekKeyOf(addDays(parseDateKey(week), byWeeks * 7));
}

export function isWeekStart(key: string): boolean {
  const d = parseDateKey(key);
  return !Number.isNaN(d.getTime()) && d.getDay() === WEEK_STARTS_ON;
}

/** True when the week begins after the current week -- it cannot be filled in. */
export function isFutureWeek(week: WeekKey, today: Date = new Date()): boolean {
  return parseDateKey(week).getTime() > parseDateKey(currentWeekKey(today)).getTime();
}

export function isFutureDate(dateKey: string, today: Date = new Date()): boolean {
  return parseDateKey(dateKey).getTime() > parseDateKey(toDateKey(today)).getTime();
}

export function isDateInWeek(dateKey: string, week: WeekKey): boolean {
  return weekDates(week).includes(dateKey);
}

export function weekRangeLabel(week: WeekKey): string {
  const start = parseDateKey(week);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth
    ? `${format(start, "d")} – ${format(end, "d MMM yyyy")}`
    : `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
}

export function weekNumberLabel(week: WeekKey): string {
  return `Week ${format(parseDateKey(week), "w, yyyy")}`;
}

export function dayLabel(dateKey: string): string {
  return format(parseDateKey(dateKey), "EEEE d MMM");
}

export function shortDayLabel(dateKey: string): string {
  return format(parseDateKey(dateKey), "EEE d MMM");
}
