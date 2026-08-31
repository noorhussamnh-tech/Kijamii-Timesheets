import { describe, expect, it } from "vitest";

import { EG_UAE_CONFIG, KSA_CONFIG, configById, configForMarket } from "./config";
import { calculateTotals, formatHours } from "./totals";
import type { TimesheetEntry } from "./types";

const WEEK = "2026-08-23";

function entry(overrides: Partial<TimesheetEntry> = {}): TimesheetEntry {
  return {
    id: "row",
    workDate: "2026-08-24",
    clientId: "c",
    clientOther: "",
    serviceId: "s",
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

describe("weekly totals", () => {
  it("splits billable from non-billable", () => {
    const totals = calculateTotals(
      [
        entry({ id: "a", hours: 6, billable: true }),
        entry({ id: "b", hours: 2.5, billable: false }),
      ],
      WEEK,
      EG_UAE_CONFIG,
      40,
    );
    expect(totals.total).toBe(8.5);
    expect(totals.billable).toBe(6);
    expect(totals.nonBillable).toBe(2.5);
  });

  it("does not accumulate floating point drift", () => {
    // Twelve quarter-hours must be exactly 3, not 2.9999999999999996.
    const rows = Array.from({ length: 12 }, (_, i) => entry({ id: `r${i}`, hours: 0.25 }));
    expect(calculateTotals(rows, WEEK, EG_UAE_CONFIG, 40).total).toBe(3);
  });

  it("treats incomplete rows as zero rather than NaN", () => {
    const totals = calculateTotals(
      [entry({ id: "a", hours: 5 }), entry({ id: "b", hours: "" })],
      WEEK,
      EG_UAE_CONFIG,
      40,
    );
    expect(totals.total).toBe(5);
  });

  it("reports missing hours below target and excess above it", () => {
    const under = calculateTotals([entry({ hours: 30 })], WEEK, EG_UAE_CONFIG, 40);
    expect(under.missing).toBe(10);
    expect(under.excess).toBe(0);

    const over = calculateTotals([entry({ hours: 44 })], WEEK, EG_UAE_CONFIG, 40);
    expect(over.missing).toBe(0);
    expect(over.excess).toBe(4);
  });

  it("uses the employee's own expected hours, not the config default", () => {
    const totals = calculateTotals([entry({ hours: 40 })], WEEK, EG_UAE_CONFIG, 45);
    expect(totals.expected).toBe(45);
    expect(totals.missing).toBe(5);
  });

  it("spreads the weekly target across working days only", () => {
    const totals = calculateTotals([], WEEK, EG_UAE_CONFIG, 40);
    expect(totals.byDay).toHaveLength(7);
    // Sunday to Thursday are working days at 8h each.
    expect(totals.byDay.filter((d) => d.isWorkingDay)).toHaveLength(5);
    expect(totals.byDay[0]?.expected).toBe(8);
    // Friday and Saturday carry no target.
    expect(totals.byDay[5]?.expected).toBe(0);
    expect(totals.byDay[6]?.expected).toBe(0);
  });

  it("attributes hours to the right day", () => {
    const totals = calculateTotals(
      [
        entry({ id: "a", workDate: "2026-08-24", hours: 3 }),
        entry({ id: "b", workDate: "2026-08-24", hours: 2 }),
        entry({ id: "c", workDate: "2026-08-26", hours: 6 }),
      ],
      WEEK,
      EG_UAE_CONFIG,
      40,
    );
    expect(totals.byDay.find((d) => d.date === "2026-08-24")?.hours).toBe(5);
    expect(totals.byDay.find((d) => d.date === "2026-08-26")?.hours).toBe(6);
    expect(totals.byDay.find((d) => d.date === "2026-08-25")?.hours).toBe(0);
  });
});

describe("configuration selection", () => {
  it("gives KSA employees the KSA configuration", () => {
    expect(configForMarket("KSA").id).toBe("KSA");
    expect(configById("KSA")).toBe(KSA_CONFIG);
  });

  it("gives Egypt and UAE employees the shared configuration", () => {
    expect(configForMarket("EG").id).toBe("EG_UAE");
    expect(configForMarket("UAE").id).toBe("EG_UAE");
    expect(configById("EG_UAE")).toBe(EG_UAE_CONFIG);
  });

  it("falls back to EG_UAE when a market is not yet set", () => {
    expect(configForMarket(null).id).toBe("EG_UAE");
    expect(configById(null).id).toBe("EG_UAE");
  });

  it("exposes no job field, since Kijamii has no job-numbering system", () => {
    for (const config of [EG_UAE_CONFIG, KSA_CONFIG]) {
      const keys = config.fields.map((f) => f.key);
      expect(keys).not.toContain("jobId");
      expect(keys).not.toContain("jobNumber");
    }
  });

  it("keeps both configurations on the same required fields", () => {
    const required = (c: typeof EG_UAE_CONFIG) =>
      c.fields
        .filter((f) => f.required)
        .map((f) => f.key)
        .sort();
    expect(required(KSA_CONFIG)).toEqual(required(EG_UAE_CONFIG));
    expect(required(EG_UAE_CONFIG)).toEqual([
      "clientId",
      "hours",
      "projectType",
      "scope",
      "serviceId",
      "workDate",
    ]);
  });
});

describe("hour formatting", () => {
  it("keeps whole numbers clean and shows quarters", () => {
    expect(formatHours(8)).toBe("8h");
    expect(formatHours(7.25)).toBe("7.25h");
    expect(formatHours(0)).toBe("0h");
    expect(formatHours(7.5)).toBe("7.5h");
  });
});
