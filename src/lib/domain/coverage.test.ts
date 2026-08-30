import { describe, expect, it } from "vitest";

import { describeMissing, monthCoverage } from "./coverage";
import { parseDateKey } from "./week";

/** Sunday to Thursday, the working week in Egypt and Saudi Arabia. */
const WORK_DAYS = [0, 1, 2, 3, 4];

describe("month coverage", () => {
  it("excludes Friday and Saturday from the working days entirely", () => {
    // August 2026 begins on a Saturday.
    const result = monthCoverage(
      parseDateKey("2026-08-15"),
      [],
      WORK_DAYS,
      parseDateKey("2026-08-15"),
    );
    // 1 Aug is a Saturday and 7, 8, 14, 15 are Fri/Sat — none may appear.
    for (const weekendDay of [
      "2026-08-01",
      "2026-08-07",
      "2026-08-08",
      "2026-08-14",
      "2026-08-15",
    ]) {
      expect(result.missing).not.toContain(weekendDay);
    }
  });

  it("lists working days with nothing logged", () => {
    const result = monthCoverage(
      parseDateKey("2026-08-05"),
      [{ date: "2026-08-02", hours: 8 }],
      WORK_DAYS,
      parseDateKey("2026-08-05"),
    );
    expect(result.logged).toEqual(["2026-08-02"]);
    // Sunday 2nd is logged; Mon 3rd to Wed 5th are not.
    expect(result.missing).toEqual(["2026-08-03", "2026-08-04", "2026-08-05"]);
  });

  it("does not count days that have not happened yet", () => {
    const result = monthCoverage(
      parseDateKey("2026-08-05"),
      [],
      WORK_DAYS,
      parseDateKey("2026-08-05"),
    );
    // Nothing beyond the 5th, even though the month runs to the 31st.
    expect(result.missing.every((d) => d <= "2026-08-05")).toBe(true);
    expect(result.missing).toContain("2026-08-05");
  });

  it("treats a day logged with zero hours as missing", () => {
    const result = monthCoverage(
      parseDateKey("2026-08-03"),
      [{ date: "2026-08-03", hours: 0 }],
      WORK_DAYS,
      parseDateKey("2026-08-03"),
    );
    expect(result.missing).toContain("2026-08-03");
  });

  it("reports full completion when every working day is covered", () => {
    const result = monthCoverage(
      parseDateKey("2026-08-04"),
      [
        { date: "2026-08-02", hours: 8 },
        { date: "2026-08-03", hours: 8 },
        { date: "2026-08-04", hours: 8 },
      ],
      WORK_DAYS,
      parseDateKey("2026-08-04"),
    );
    expect(result.missing).toEqual([]);
    expect(result.completion).toBe(1);
  });

  it("reports completion as a fraction of working days so far", () => {
    const result = monthCoverage(
      parseDateKey("2026-08-05"),
      [
        { date: "2026-08-02", hours: 8 },
        { date: "2026-08-03", hours: 8 },
      ],
      WORK_DAYS,
      parseDateKey("2026-08-05"),
    );
    expect(result.workingDaysSoFar).toBe(4);
    expect(result.completion).toBe(0.5);
  });

  it("does not divide by zero at the very start of a month", () => {
    // 1 August 2026 is a Saturday, so no working days have passed.
    const result = monthCoverage(
      parseDateKey("2026-08-01"),
      [],
      WORK_DAYS,
      parseDateKey("2026-08-01"),
    );
    expect(result.workingDaysSoFar).toBe(0);
    expect(result.completion).toBe(1);
  });

  it("honours a different working week", () => {
    // A Monday-to-Friday market would flag Sunday as a non-working day.
    const result = monthCoverage(
      parseDateKey("2026-08-05"),
      [],
      [1, 2, 3, 4, 5],
      parseDateKey("2026-08-05"),
    );
    expect(result.missing).not.toContain("2026-08-02");
  });
});

describe("describing the gaps", () => {
  it("names a single day", () => {
    expect(describeMissing(["2026-08-24"])).toBe("24 Aug");
  });

  it("joins several days readably", () => {
    expect(describeMissing(["2026-08-24", "2026-08-25", "2026-08-26"])).toBe("24, 25 and 26 Aug");
  });

  it("shows only the most recent few", () => {
    const many = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-10"];
    expect(describeMissing(many, 2)).toBe("6 and 10 Aug");
  });

  it("says nothing when nothing is missing", () => {
    expect(describeMissing([])).toBe("");
  });
});
