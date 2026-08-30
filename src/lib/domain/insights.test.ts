import { describe, expect, it } from "vitest";

import {
  averageHoursPerEntry,
  billableShare,
  buildTrivia,
  busiestWeekday,
  changeVsPrevious,
  topClientShare,
  workPersonality,
  type PersonalStats,
} from "./insights";

function stats(overrides: Partial<PersonalStats> = {}): PersonalStats {
  return {
    from: "2026-08-01",
    to: "2026-08-31",
    totalHours: 100,
    billableHours: 80,
    entryCount: 40,
    daysLogged: 20,
    distinctClients: 3,
    distinctServices: 3,
    longestStreak: 4,
    busiestDay: { date: "2026-08-12", hours: 9 },
    topClient: { name: "MYF", hours: 40 },
    topService: { name: "Copywriting", hours: 50 },
    topTask: { name: "Copy", hours: 30 },
    clients: [{ name: "MYF", hours: 40 }],
    byWeekday: [
      { dow: 0, hours: 10 },
      { dow: 1, hours: 30 },
      { dow: 2, hours: 25 },
      { dow: 3, hours: 20 },
      { dow: 4, hours: 15 },
    ],
    previousTotal: 80,
    expectedWeeklyHours: 40,
    ...overrides,
  };
}

describe("derived measures", () => {
  it("computes shares and averages", () => {
    const s = stats();
    expect(topClientShare(s)).toBeCloseTo(0.4);
    expect(billableShare(s)).toBeCloseTo(0.8);
    expect(averageHoursPerEntry(s)).toBe(2.5);
    expect(changeVsPrevious(s)).toBeCloseTo(0.25);
    expect(busiestWeekday(s)).toBe(1);
  });

  it("never divides by zero on an empty period", () => {
    const empty = stats({
      totalHours: 0,
      billableHours: 0,
      entryCount: 0,
      daysLogged: 0,
      previousTotal: 0,
      topClient: null,
      byWeekday: [],
    });
    expect(topClientShare(empty)).toBe(0);
    expect(billableShare(empty)).toBe(0);
    expect(averageHoursPerEntry(empty)).toBe(0);
    // No previous data means no comparison, rather than a fake 0%.
    expect(changeVsPrevious(empty)).toBeNull();
    expect(busiestWeekday(empty)).toBeNull();
  });

  it("reports a decrease as a negative change", () => {
    expect(changeVsPrevious(stats({ totalHours: 60, previousTotal: 80 }))).toBeCloseTo(-0.25);
  });
});

describe("work personality", () => {
  it("has something to say before anything is logged", () => {
    expect(workPersonality(stats({ entryCount: 0 })).id).toBe("unwritten");
  });

  it("recognises concentration on one client", () => {
    const s = stats({ topClient: { name: "Keeta", hours: 75 }, totalHours: 100 });
    const p = workPersonality(s);
    expect(p.id).toBe("devoted");
    expect(p.blurb).toContain("Keeta");
    expect(p.blurb).toContain("75%");
  });

  it("recognises spread across many clients", () => {
    expect(
      workPersonality(stats({ distinctClients: 7, topClient: { name: "MYF", hours: 20 } })).id,
    ).toBe("juggler");
  });

  it("distinguishes long blocks from many small pieces", () => {
    // 100h over 20 entries = 5h each.
    expect(
      workPersonality(stats({ entryCount: 20, topClient: { name: "MYF", hours: 20 } })).id,
    ).toBe("deep-worker");
    // 100h over 80 entries = 1.25h each.
    expect(
      workPersonality(stats({ entryCount: 80, topClient: { name: "MYF", hours: 20 } })).id,
    ).toBe("sprinter");
  });

  it("always returns a personality, whatever the shape of the data", () => {
    for (const s of [
      stats(),
      stats({ distinctClients: 1, distinctServices: 1 }),
      stats({ longestStreak: 30 }),
      stats({ totalHours: 0.25, entryCount: 1, daysLogged: 1 }),
    ]) {
      const p = workPersonality(s);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(0);
    }
  });
});

describe("trivia", () => {
  it("says nothing at all when nothing was logged", () => {
    expect(buildTrivia(stats({ entryCount: 0 }))).toEqual([]);
  });

  it("surfaces the client, service, busiest day, streak and trend", () => {
    const ids = buildTrivia(stats()).map((t) => t.id);
    expect(ids).toContain("top-client");
    expect(ids).toContain("top-service");
    expect(ids).toContain("busiest-day");
    expect(ids).toContain("streak");
    expect(ids).toContain("trend");
  });

  it("omits a trend when the change is negligible", () => {
    const ids = buildTrivia(stats({ totalHours: 100, previousTotal: 98 })).map((t) => t.id);
    expect(ids).not.toContain("trend");
  });

  it("omits a streak that is not worth mentioning", () => {
    const ids = buildTrivia(stats({ longestStreak: 2 })).map((t) => t.id);
    expect(ids).not.toContain("streak");
  });

  it("skips facts whose underlying value is missing", () => {
    const ids = buildTrivia(stats({ topClient: null, topService: null, topTask: null })).map(
      (t) => t.id,
    );
    expect(ids).not.toContain("top-client");
    expect(ids).not.toContain("top-service");
    expect(ids).not.toContain("top-task");
  });
});
