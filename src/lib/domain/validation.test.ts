import { describe, expect, it } from "vitest";

import {
  isBlankRow,
  isQuarterHour,
  missingFields,
  validateHours,
  validateWeek,
} from "./validation";
import type { TimesheetEntry } from "./types";

const WEEK = "2026-08-23";

function entry(overrides: Partial<TimesheetEntry> = {}): TimesheetEntry {
  return {
    id: overrides.id ?? "row-1",
    workDate: "2026-08-24",
    clientId: "client-1",
    clientOther: "",
    serviceId: "service-1",
    projectType: "Campaign",
    task: "Copy",
    scope: "in_scope",
    projectNote: "",
    hours: 4,
    billable: true,
    status: "draft",
    ...overrides,
  };
}

describe("hours validation", () => {
  it("accepts quarter-hour increments and rejects anything else", () => {
    for (const value of [0.25, 0.5, 1, 4.75, 7.25, 15.75, 16]) {
      expect(isQuarterHour(value)).toBe(true);
      expect(validateHours(value)).toBeNull();
    }
    for (const value of [0.1, 1.3, 2.33, 7.2]) {
      expect(isQuarterHour(value)).toBe(false);
      expect(validateHours(value)).toBe("hours");
    }
  });

  it("survives floating point representation", () => {
    // 0.1 + 0.2 is 0.30000000000000004; a naive modulo check misjudges sums
    // like this one, which real timesheets produce constantly.
    expect(isQuarterHour(0.25 + 0.5)).toBe(true);
    expect(isQuarterHour(1.75 + 2.5)).toBe(true);
    expect(isQuarterHour(0.1 + 0.2)).toBe(false);
  });

  it("rejects zero, negative, empty and non-finite hours", () => {
    expect(validateHours("")).toBe("hours");
    expect(validateHours(0)).toBe("hours");
    expect(validateHours(-2)).toBe("hours");
    expect(validateHours(Number.NaN)).toBe("hours");
    expect(validateHours(Number.POSITIVE_INFINITY)).toBe("hours");
  });

  it("rejects more than 16 hours on one row", () => {
    expect(validateHours(16)).toBeNull();
    expect(validateHours(16.25)).toBe("hours");
  });
});

describe("row completeness", () => {
  it("treats an untouched row as blank", () => {
    const blank = entry({
      clientId: "",
      serviceId: "",
      projectType: "",
      task: "",
      hours: "",
    });
    expect(isBlankRow(blank)).toBe(true);
    // A row with anything at all in it is no longer blank.
    expect(isBlankRow({ ...blank, projectNote: "note" })).toBe(false);
    expect(isBlankRow({ ...blank, hours: 1 })).toBe(false);
  });

  it("lists every missing required field", () => {
    expect(missingFields(entry())).toEqual([]);
    expect(missingFields(entry({ serviceId: "", hours: "" }))).toEqual(["serviceId", "hours"]);
  });

  it("accepts a free-text client name in place of a client id", () => {
    const other = entry({ clientId: "", clientOther: "Some new client" });
    expect(missingFields(other)).toEqual([]);
    // Whitespace alone is not a client name.
    expect(missingFields(entry({ clientId: "", clientOther: "   " }))).toContain("clientId");
  });
});

describe("week validation", () => {
  it("passes a complete week", () => {
    const result = validateWeek([entry()], WEEK);
    expect(result.ok).toBe(true);
  });

  it("requires at least one entry", () => {
    const result = validateWeek([], WEEK);
    expect(result.ok).toBe(false);
    expect(result.weekIssues[0]?.code).toBe("no_entries");
  });

  it("ignores trailing blank rows rather than blocking on them", () => {
    const blank = entry({
      id: "row-2",
      clientId: "",
      serviceId: "",
      projectType: "",
      task: "",
      hours: "",
    });
    const result = validateWeek([entry(), blank], WEEK, {});
    expect(result.ok).toBe(true);
    expect(result.rowIssues).toEqual([]);
  });

  it("flags a day totalling more than 16 hours across several rows", () => {
    const rows = [
      entry({ id: "a", hours: 8 }),
      entry({ id: "b", hours: 8 }),
      entry({ id: "c", hours: 1 }),
    ];
    const result = validateWeek(rows, WEEK);
    expect(result.ok).toBe(false);
    expect(result.weekIssues.some((i) => i.code === "day_over_limit")).toBe(true);
  });

  it("allows exactly 16 hours in a day", () => {
    const rows = [entry({ id: "a", hours: 8 }), entry({ id: "b", hours: 8 })];
    expect(validateWeek(rows, WEEK).ok).toBe(true);
  });

  it("accepts a date that has not arrived yet", () => {
    // People fill days in ahead of time, and weekends get worked. The only
    // date rule left is that a row belongs to the week it is filed under.
    expect(validateWeek([entry({ workDate: "2026-08-27" })], WEEK).ok).toBe(true);
  });

  it("accepts a weekend day", () => {
    // 2026-08-28 is a Friday and 2026-08-29 a Saturday.
    expect(validateWeek([entry({ workDate: "2026-08-28" })], WEEK).ok).toBe(true);
    expect(validateWeek([entry({ workDate: "2026-08-29" })], WEEK).ok).toBe(true);
  });

  it("rejects a date outside the selected week", () => {
    const result = validateWeek([entry({ workDate: "2026-09-02" })], WEEK);
    expect(result.ok).toBe(false);
    expect(result.weekIssues.some((i) => i.code === "date_outside_week")).toBe(true);
  });

  it("scopes validation to a single day for per-day submission", () => {
    const rows = [
      entry({ id: "good", workDate: "2026-08-24" }),
      entry({ id: "bad", workDate: "2026-08-25", serviceId: "" }),
    ];
    // The whole week is invalid because of the second row...
    expect(validateWeek(rows, WEEK).ok).toBe(false);
    // ...but submitting only the first day is fine.
    expect(validateWeek(rows, WEEK, { scope: "2026-08-24" }).ok).toBe(true);
  });

  it("reports the offending row so the UI can highlight it", () => {
    const rows = [entry({ id: "broken", hours: "" })];
    const result = validateWeek(rows, WEEK);
    expect(result.rowIssues).toHaveLength(1);
    expect(result.rowIssues[0]?.entryId).toBe("broken");
    expect(result.rowIssues[0]?.fields).toContain("hours");
  });
});
