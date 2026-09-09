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
  weekRangeLabel,
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

describe("the days the Date field offers", () => {
  /*
   * The field offers the viewed week and nothing else, which is the whole of
   * the rule now: the header says which week you are in, and the field beside
   * it must not disagree. It used to reach back a month, so a row filed under
   * "6 - 12 Sep" could be dated into August from a dropdown sitting under that
   * heading.
   *
   * No day is filtered out. An earlier version stopped at today, which read as
   * caution and behaved as a trap: on the Sunday a week begins it left exactly
   * one option, and a week ahead of today -- which the app now accepts -- could
   * not be filled in at all.
   */
  it("offers the seven days of the viewed week, in order", () => {
    expect(weekDates("2026-09-06")).toEqual([
      "2026-09-06",
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ]);
  });

  it("offers days still to come, not only those that have happened", () => {
    // Wednesday 9 September, mid-week: Thursday through Saturday are offered.
    const offered = weekDates("2026-09-06");
    expect(offered.filter((date) => isFutureDate(date, parseDateKey("2026-09-09")))).toEqual([
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ]);
  });

  it("offers a full week on the Sunday one begins", () => {
    // The old rule left a single option here, and nothing to pick between.
    expect(weekDates("2026-09-06")).toHaveLength(7);
  });

  it("offers nothing outside the week it belongs to", () => {
    for (const date of weekDates("2026-09-06")) {
      expect(isDateInWeek(date, "2026-09-06")).toBe(true);
    }
    expect(isDateInWeek("2026-09-05", "2026-09-06")).toBe(false);
    expect(isDateInWeek("2026-09-13", "2026-09-06")).toBe(false);
  });

  /*
   * The two halves of the header have to agree with the field. These assert
   * the pairing directly rather than each side on its own, because the failure
   * that matters is them drifting apart.
   */
  it("agrees with the range the header prints", () => {
    const offered = weekDates("2026-09-06");
    expect(weekRangeLabel("2026-09-06")).toBe("6 – 12 Sep 2026");
    expect(offered.at(0)).toBe("2026-09-06");
    expect(offered.at(-1)).toBe(weekEnd("2026-09-06"));
  });

  it("agrees with it across a month boundary too", () => {
    // The one place a mismatch would actually bite: the label changes shape
    // when a week straddles two months, and the dates must still line up.
    const offered = weekDates("2026-08-30");
    expect(weekRangeLabel("2026-08-30")).toBe("30 Aug – 5 Sep 2026");
    expect(offered.at(0)).toBe("2026-08-30");
    expect(offered.at(-1)).toBe("2026-09-05");
    expect(offered).toHaveLength(7);
  });
});
