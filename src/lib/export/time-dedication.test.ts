import { describe, expect, it } from "vitest";

import type { TimeDedicationRow } from "@/lib/data/api";
import { monthKeys, toLongRows, toWideRows } from "@/lib/export/time-dedication";

function row(overrides: Partial<TimeDedicationRow>): TimeDedicationRow {
  return {
    lookupKey: null,
    employeeCode: null,
    employeeName: "Someone",
    department: null,
    market: null,
    clientCode: null,
    brandName: null,
    month: null,
    hours: 0,
    ...overrides,
  };
}

describe("monthKeys", () => {
  it("covers the whole year, zero-padded", () => {
    const keys = monthKeys(2026);
    expect(keys).toHaveLength(12);
    expect(keys[0]).toBe("2026-01");
    expect(keys[8]).toBe("2026-09");
    expect(keys[11]).toBe("2026-12");
  });
});

describe("toWideRows", () => {
  const HEADER_COLUMNS = 6;

  it("puts each month's hours under its own column", () => {
    const shaped = toWideRows(
      [
        row({ employeeName: "Amina", brandName: "Visa", month: "2026-01", hours: "4.50" }),
        row({ employeeName: "Amina", brandName: "Visa", month: "2026-03", hours: 2 }),
      ],
      2026,
    );

    expect(shaped.rows).toHaveLength(1);
    const [jan, feb, mar] = shaped.rows[0]!.slice(HEADER_COLUMNS, HEADER_COLUMNS + 3);
    expect(jan).toBe(4.5);
    expect(feb).toBe(0);
    expect(mar).toBe(2);
    // The total sits after the twelve month columns.
    expect(shaped.rows[0]!.at(-1)).toBe(6.5);
  });

  it("keeps a brand of one person's separate from another's", () => {
    const shaped = toWideRows(
      [
        row({ employeeName: "Amina", brandName: "Visa", month: "2026-01", hours: 3 }),
        row({ employeeName: "Basma", brandName: "Visa", month: "2026-01", hours: 5 }),
      ],
      2026,
    );

    expect(shaped.rows).toHaveLength(2);
    expect(shaped.rows.map((r) => r[1])).toEqual(["Amina", "Basma"]);
  });

  it("keeps someone who logged nothing, as a row of zeros", () => {
    const shaped = toWideRows([row({ employeeName: "Quiet", market: "EG" })], 2026);

    expect(shaped.rows).toHaveLength(1);
    expect(shaped.rows[0]![1]).toBe("Quiet");
    expect(shaped.rows[0]![5]).toBe("");
    expect(shaped.rows[0]!.slice(HEADER_COLUMNS, HEADER_COLUMNS + 12)).toEqual(
      Array.from({ length: 12 }, () => 0),
    );
    expect(shaped.rows[0]!.at(-1)).toBe(0);
  });

  it("ignores hours from a month outside the exported year", () => {
    const shaped = toWideRows(
      [row({ employeeName: "Amina", brandName: "Visa", month: "2025-01", hours: 9 })],
      2026,
    );

    expect(shaped.rows[0]!.at(-1)).toBe(0);
  });

  it("groups two people who share a name but not a code", () => {
    const shaped = toWideRows(
      [
        row({
          employeeCode: "E1",
          employeeName: "Ali",
          brandName: "Visa",
          month: "2026-01",
          hours: 1,
        }),
        row({
          employeeCode: "E2",
          employeeName: "Ali",
          brandName: "Visa",
          month: "2026-01",
          hours: 2,
        }),
      ],
      2026,
    );

    expect(shaped.rows).toHaveLength(2);
    expect(shaped.rows.map((r) => r.at(-1))).toEqual([1, 2]);
  });
});

describe("toLongRows", () => {
  it("carries the lookup key through untouched", () => {
    const shaped = toLongRows([
      row({
        lookupKey: "e-101|CLI-004|2026-08",
        employeeCode: "e-101",
        employeeName: "Amina",
        clientCode: "CLI-004",
        brandName: "Bioderma",
        month: "2026-08",
        hours: "10.00",
      }),
    ]);

    expect(shaped.headers[0]).toBe("lookup_key");
    expect(shaped.rows[0]![0]).toBe("e-101|CLI-004|2026-08");
    expect(shaped.rows[0]!.at(-1)).toBe(10);
  });

  it("writes blanks rather than the word null for a roster row", () => {
    const shaped = toLongRows([row({ employeeName: "Quiet" })]);

    expect(shaped.rows[0]).toEqual(["", "", "Quiet", "", "", "", "", "", 0]);
  });
});
