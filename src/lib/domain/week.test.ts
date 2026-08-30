import { describe, expect, it } from "vitest";

import {
  currentWeekKey,
  isDateInWeek,
  isFutureDate,
  isFutureWeek,
  isWeekStart,
  parseDateKey,
  shiftWeek,
  toDateKey,
  weekDates,
  weekEnd,
  weekKeyOf,
} from "./week";

describe("week arithmetic", () => {
  it("anchors a week to the preceding Sunday", () => {
    // 2026-08-26 is a Wednesday; its week starts Sunday 2026-08-23.
    expect(weekKeyOf(parseDateKey("2026-08-26"))).toBe("2026-08-23");
    // A Sunday is its own week start.
    expect(weekKeyOf(parseDateKey("2026-08-23"))).toBe("2026-08-23");
    // A Saturday still belongs to the week that began the previous Sunday.
    expect(weekKeyOf(parseDateKey("2026-08-29"))).toBe("2026-08-23");
  });

  it("produces seven consecutive dates ending on Saturday", () => {
    const dates = weekDates("2026-08-23");
    expect(dates).toEqual([
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
    ]);
    expect(weekEnd("2026-08-23")).toBe("2026-08-29");
  });

  it("keeps week keys stable across month and year boundaries", () => {
    expect(shiftWeek("2026-01-04", -1)).toBe("2025-12-28");
    expect(shiftWeek("2025-12-28", 1)).toBe("2026-01-04");
    // A leap-year February must not drift.
    expect(shiftWeek("2028-02-27", 1)).toBe("2028-03-05");
  });

  it("recognises only Sundays as week starts", () => {
    expect(isWeekStart("2026-08-23")).toBe(true);
    expect(isWeekStart("2026-08-24")).toBe(false);
  });

  it("treats a date key as a local calendar date, not as UTC", () => {
    // Parsing "2026-08-23" as UTC would roll back a day in any negative
    // offset and silently shift every week key.
    const parsed = parseDateKey("2026-08-23");
    expect(parsed.getDate()).toBe(23);
    expect(parsed.getMonth()).toBe(7);
    expect(toDateKey(parsed)).toBe("2026-08-23");
  });

  it("identifies future weeks and dates against a fixed today", () => {
    const today = parseDateKey("2026-08-26");
    expect(isFutureWeek("2026-08-30", today)).toBe(true);
    expect(isFutureWeek("2026-08-23", today)).toBe(false);
    // The current week is never "future", even later in the same week.
    expect(isFutureWeek(currentWeekKey(today), today)).toBe(false);

    expect(isFutureDate("2026-08-27", today)).toBe(true);
    expect(isFutureDate("2026-08-26", today)).toBe(false);
    expect(isFutureDate("2026-08-25", today)).toBe(false);
  });

  it("confines a date to its own week", () => {
    expect(isDateInWeek("2026-08-29", "2026-08-23")).toBe(true);
    expect(isDateInWeek("2026-08-30", "2026-08-23")).toBe(false);
    expect(isDateInWeek("2026-08-22", "2026-08-23")).toBe(false);
  });
});
