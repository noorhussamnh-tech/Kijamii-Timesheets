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

describe("daily focus", () => {
  /**
   * Mirrors the store's focusDate rule: the screen opens on today when the
   * viewed week contains it, and on the week start otherwise. Getting this
   * wrong lands someone on Sunday on a Wednesday, which is the friction that
   * stops a daily habit forming.
   */
  const focusDateFor = (week: string, today: Date) => {
    const all = weekDates(week);
    const key = toDateKey(today);
    return all.includes(key) ? key : all[0]!;
  };

  it("opens on today when today is inside the viewed week", () => {
    expect(focusDateFor("2026-08-23", parseDateKey("2026-08-26"))).toBe("2026-08-26");
    // Including the first and last day of the week.
    expect(focusDateFor("2026-08-23", parseDateKey("2026-08-23"))).toBe("2026-08-23");
    expect(focusDateFor("2026-08-23", parseDateKey("2026-08-29"))).toBe("2026-08-29");
  });

  it("falls back to the week start when looking at another week", () => {
    expect(focusDateFor("2026-08-16", parseDateKey("2026-08-26"))).toBe("2026-08-16");
    expect(focusDateFor("2026-08-30", parseDateKey("2026-08-26"))).toBe("2026-08-30");
  });
});

describe("selectable days", () => {
  /**
   * Mirrors the store's selectableDates rule. Offering a day that cannot be
   * submitted, then rejecting it at submit time, is a trap; the future is
   * simply not selectable.
   */
  const selectableFor = (week: string, today: Date) =>
    weekDates(week).filter((date) => !isFutureDate(date, today));

  it("stops at today within the current week", () => {
    // Wednesday 2026-08-26, in the week beginning Sunday 2026-08-23.
    expect(selectableFor("2026-08-23", parseDateKey("2026-08-26"))).toEqual([
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
    ]);
  });

  it("allows every day of a week that has already passed", () => {
    expect(selectableFor("2026-08-16", parseDateKey("2026-08-26"))).toHaveLength(7);
  });

  it("allows the whole week once its last day has arrived", () => {
    expect(selectableFor("2026-08-23", parseDateKey("2026-08-29"))).toHaveLength(7);
  });

  it("allows only the first day on the Sunday a week begins", () => {
    expect(selectableFor("2026-08-23", parseDateKey("2026-08-23"))).toEqual(["2026-08-23"]);
  });
});
