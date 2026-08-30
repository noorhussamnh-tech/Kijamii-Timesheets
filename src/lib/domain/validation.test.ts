import { describe, expect, it } from "vitest";

import {
  isBlankRow,
  isQuarterHour,
  missingFields,
  validateHours,
  validateWeek,
} from "./validation";
import { parseDateKey } from "./week";
import type { TimesheetEntry } from "./types";

const WEEK = "2026-08-23";
const TODAY = parseDateKey("2026-08-26");

function entry(overrides: Partial<TimesheetEntry> = {}): TimesheetEntry {
  return {
    id: overrides.id ?? "row-1",
    workDate: "2026-08-24",
    clientId: "client-1",
    clientOther: "",
    serviceId: "service-1",
    projectType: "Campaign",
    task: "Copy",
    projectNote: "",
    hours: 4,
    billable: true,
    status: "draft",
    ...overrides,
  };
}

describe("hours validation", () => {
  it("accepts quarter-hour increments and rejects anything else", () => {
    for (const value of [0.25, 0.5, 1, 4.75, 7.25, 23.75, 24]) {
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

  it("rejects more than 24 hours on one row", () => {
    expect(validateHours(24)).toBeNull();
    expect(validateHours(24.25)).toBe("hours");
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
    const result = validateWeek([entry()], WEEK, { today: TODAY });
    expect(result.ok).toBe(true);
  });

  it("requires at least one entry", () => {
    const result = validateWeek([], WEEK, { today: TODAY });
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
    const result = validateWeek([entry(), blank], WEEK, { today: TODAY });
    expect(result.ok).toBe(true);
    expect(result.rowIssues).toEqual([]);
  });

  it("flags a day totalling more than 24 hours across several rows", () => {
    const rows = [
      entry({ id: "a", hours: 12 }),
      entry({ id: "b", hours: 12 }),
      entry({ id: "c", hours: 1 }),
    ];
    const result = validateWeek(rows, WEEK, { today: TODAY });
    expect(result.ok).toBe(false);
    expect(result.weekIssues.some((i) => i.code === "day_over_24h")).toBe(true);
  });

  it("allows exactly 24 hours in a day", () => {
    const rows = [entry({ id: "a", hours: 12 }), entry({ id: "b", hours: 12 })];
    expect(validateWeek(rows, WEEK, { today: TODAY }).ok).toBe(true);
  });

  it("rejects a future date", () => {
    const result = validateWeek([entry({ workDate: "2026-08-27" })], WEEK, { today: TODAY });
    expect(result.ok).toBe(false);
    expect(result.weekIssues.some((i) => i.code === "future_date")).toBe(true);
  });

  it("accepts today", () => {
    expect(validateWeek([entry({ workDate: "2026-08-26" })], WEEK, { today: TODAY }).ok).toBe(true);
  });

  it("rejects a date outside the selected week", () => {
    const result = validateWeek([entry({ workDate: "2026-09-02" })], WEEK, { today: TODAY });
    expect(result.ok).toBe(false);
    expect(result.weekIssues.some((i) => i.code === "date_outside_week")).toBe(true);
  });

  it("scopes validation to a single day for per-day submission", () => {
    const rows = [
      entry({ id: "good", workDate: "2026-08-24" }),
      entry({ id: "bad", workDate: "2026-08-25", serviceId: "" }),
    ];
    // The whole week is invalid because of the second row...
    expect(validateWeek(rows, WEEK, { today: TODAY }).ok).toBe(false);
    // ...but submitting only the first day is fine.
    expect(validateWeek(rows, WEEK, { scope: "2026-08-24", today: TODAY }).ok).toBe(true);
  });

  it("reports the offending row so the UI can highlight it", () => {
    const rows = [entry({ id: "broken", hours: "" })];
    const result = validateWeek(rows, WEEK, { today: TODAY });
    expect(result.rowIssues).toHaveLength(1);
    expect(result.rowIssues[0]?.entryId).toBe("broken");
    expect(result.rowIssues[0]?.fields).toContain("hours");
  });
});
