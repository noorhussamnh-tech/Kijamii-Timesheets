/**
 * Validation rules, shared by the browser and used again on the server.
 *
 * The browser runs these for immediate feedback; the same rules are enforced
 * by `ts_validate_week` and by CHECK constraints in Postgres, which is the
 * copy that actually decides. Keeping the messages here means the two layers
 * agree on wording as well as on outcome.
 */
import { isDateInWeek, dayLabel } from "./week";
import type { TimesheetEntry } from "./types";

export const HOURS_STEP = 0.25;
/** People work long days sometimes; beyond this it is a typo, not a shift. */
export const MAX_HOURS_PER_DAY = 16;

export interface RowIssue {
  entryId: string;
  fields: string[];
  message: string;
}

export interface WeekIssue {
  code: "no_entries" | "day_over_limit" | "date_outside_week";
  date?: string;
  message: string;
}

export interface ValidationResult {
  rowIssues: RowIssue[];
  weekIssues: WeekIssue[];
  get ok(): boolean;
}

/** True when a row has been touched at all. Untouched rows are ignored. */
export function isBlankRow(entry: TimesheetEntry): boolean {
  return (
    !entry.clientId &&
    !entry.clientOther.trim() &&
    !entry.serviceId &&
    !entry.projectType &&
    !entry.task &&
    !entry.projectNote.trim() &&
    entry.hours === ""
  );
}

export function isQuarterHour(hours: number): boolean {
  // Compare in quarter units to avoid binary floating point drift: 0.1 + 0.2
  // is not 0.3, but 7.25 * 4 is exactly 29.
  const quarters = hours * 4;
  return Math.abs(quarters - Math.round(quarters)) < 1e-9;
}

export function validateHours(hours: number | ""): string | null {
  if (hours === "") return "hours";
  if (!Number.isFinite(hours)) return "hours";
  if (hours <= 0) return "hours";
  if (hours > MAX_HOURS_PER_DAY) return "hours";
  if (!isQuarterHour(hours)) return "hours";
  return null;
}

/** Which required fields a row is missing. Empty means the row is complete. */
export function missingFields(entry: TimesheetEntry): string[] {
  const missing: string[] = [];
  if (!entry.workDate) missing.push("workDate");
  if (!entry.clientId && !entry.clientOther.trim()) missing.push("clientId");
  if (!entry.serviceId) missing.push("serviceId");
  if (!entry.projectType) missing.push("projectType");
  if (!entry.task) missing.push("task");
  if (validateHours(entry.hours)) missing.push("hours");
  return missing;
}

function hoursOf(entry: TimesheetEntry): number {
  return typeof entry.hours === "number" ? entry.hours : 0;
}

/**
 * Validates a set of rows. `scope` limits checking to a single day, which is
 * what per-day submission needs; omit it to validate the whole week.
 */
export function validateWeek(
  entries: TimesheetEntry[],
  weekStart: string,
  options: { scope?: string } = {},
): ValidationResult {
  const { scope } = options;
  const inScope = scope ? entries.filter((e) => e.workDate === scope) : entries;

  const rowIssues: RowIssue[] = [];
  const weekIssues: WeekIssue[] = [];

  // Entirely blank rows are ignored rather than flagged -- people leave a
  // trailing empty row behind constantly and it should not block them.
  const meaningful = inScope.filter((e) => !isBlankRow(e));

  if (meaningful.length === 0) {
    weekIssues.push({
      code: "no_entries",
      message: "Add at least one entry before submitting.",
    });
  }

  for (const entry of meaningful) {
    const fields = missingFields(entry);
    if (fields.length > 0) {
      rowIssues.push({
        entryId: entry.id,
        fields,
        message: fields.includes("hours")
          ? "Hours must be greater than zero, in steps of 0.25."
          : "Complete every required field on this row.",
      });
    }
  }

  // Total hours per day, however the day is split across rows.
  const perDay = new Map<string, number>();
  for (const entry of meaningful) {
    perDay.set(entry.workDate, (perDay.get(entry.workDate) ?? 0) + hoursOf(entry));
  }
  for (const [date, total] of perDay) {
    if (total > MAX_HOURS_PER_DAY) {
      weekIssues.push({
        code: "day_over_limit",
        date,
        message: `${dayLabel(date)} totals ${total} hours. The most that can be logged in a day is ${MAX_HOURS_PER_DAY}.`,
      });
    }
  }

  // Dates are otherwise unrestricted: weekends are worked, and a day can be
  // filled in whenever suits. The only rule left is that a row belongs to the
  // week it is filed under, which the database enforces too.
  for (const date of perDay.keys()) {
    if (!isDateInWeek(date, weekStart)) {
      weekIssues.push({
        code: "date_outside_week",
        date,
        message: "This date is outside the selected week.",
      });
    }
  }

  return {
    rowIssues,
    weekIssues,
    get ok() {
      return this.rowIssues.length === 0 && this.weekIssues.length === 0;
    },
  };
}
