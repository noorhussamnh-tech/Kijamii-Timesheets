import { describe, expect, it } from "vitest";

import { accountShares, wholePercentages } from "@/lib/domain/shares";

describe("accountShares", () => {
  it("orders by hours and reports each as a fraction of the whole", () => {
    const shares = accountShares([
      { name: "Visa", hours: 10 },
      { name: "Bioderma", hours: 30 },
    ]);

    expect(shares.map((s) => s.name)).toEqual(["Bioderma", "Visa"]);
    expect(shares[0]!.fraction).toBeCloseTo(0.75);
    expect(shares[1]!.fraction).toBeCloseTo(0.25);
  });

  it("keeps every hour when it folds the tail, so the parts still sum to one", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ name: `C${i}`, hours: 12 - i }));
    const shares = accountShares(rows, 5);

    expect(shares).toHaveLength(5);
    expect(shares.at(-1)!.isOther).toBe(true);
    expect(shares.reduce((sum, s) => sum + s.fraction, 0)).toBeCloseTo(1);
    expect(shares.reduce((sum, s) => sum + s.hours, 0)).toBe(
      rows.reduce((sum, r) => sum + r.hours, 0),
    );
  });

  it("does not fold a single account into a vaguer label", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ name: `C${i}`, hours: 5 - i }));
    const shares = accountShares(rows, 5);

    expect(shares).toHaveLength(5);
    expect(shares.some((s) => s.isOther)).toBe(false);
  });

  it("ignores rows with no hours, and names a blank account rather than dropping it", () => {
    const shares = accountShares([
      { name: "Visa", hours: 0 },
      { name: null, hours: 4 },
    ]);

    expect(shares).toHaveLength(1);
    expect(shares[0]!.name).toBe("Unnamed");
  });

  it("returns nothing when there are no hours at all", () => {
    expect(accountShares([{ name: "Visa", hours: 0 }])).toEqual([]);
  });
});

describe("wholePercentages", () => {
  it("adds to exactly 100 where naive rounding would not", () => {
    // Three equal thirds round to 33 each, which shows a chart claiming 99%.
    const pct = wholePercentages([1 / 3, 1 / 3, 1 / 3]);
    expect(pct.reduce((sum, p) => sum + p, 0)).toBe(100);
  });

  it("gives the spare point to the largest remainder", () => {
    expect(wholePercentages([0.335, 0.335, 0.33])).toEqual([34, 33, 33]);
  });

  it("still totals 100 across many small shares", () => {
    const pct = wholePercentages(Array.from({ length: 7 }, () => 1 / 7));
    expect(pct.reduce((sum, p) => sum + p, 0)).toBe(100);
  });
});
