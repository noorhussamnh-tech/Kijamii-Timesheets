import { describe, expect, it } from "vitest";

import type { PersonalStats } from "@/lib/domain/insights";
import { milestoneFor, wryLine } from "@/lib/domain/milestones";

function stats(overrides: Partial<PersonalStats> = {}): PersonalStats {
  return {
    from: "2026-08-01",
    to: "2026-08-31",
    totalHours: 0,
    billableHours: 0,
    entryCount: 0,
    daysLogged: 0,
    distinctClients: 0,
    distinctServices: 0,
    longestStreak: 0,
    busiestDay: null,
    topClient: null,
    topService: null,
    topTask: null,
    clients: [],
    byWeekday: [],
    previousTotal: 0,
    expectedWeeklyHours: 40,
    ...overrides,
  };
}

const none = new Set<string>();

describe("milestoneFor", () => {
  it("says nothing to somebody who has logged nothing", () => {
    expect(milestoneFor(stats(), none)).toBeNull();
  });

  it("celebrates the first entry", () => {
    expect(milestoneFor(stats({ entryCount: 1, totalHours: 2 }), none)?.id).toBe("first-entry");
  });

  it("never repeats a milestone already celebrated", () => {
    const seen = new Set(["first-entry"]);
    expect(milestoneFor(stats({ entryCount: 1 }), seen)).toBeNull();
  });

  it("fires one at a time, rarest first", () => {
    const rich = stats({ entryCount: 40, daysLogged: 22, longestStreak: 22, totalHours: 100 });
    const first = milestoneFor(rich, none);
    expect(first?.id).toBe("streak-20");

    // The runner-up is still waiting on the next visit rather than lost.
    const second = milestoneFor(rich, new Set([first!.id]));
    expect(second?.id).toBe("streak-5");
  });

  it("treats a full week of logging as its own milestone", () => {
    const week = stats({ entryCount: 9, daysLogged: 5 });
    expect(milestoneFor(week, new Set(["first-entry"]))?.id).toBe("full-week");
  });

  it("celebrates beating the previous period, but ranks it last", () => {
    const busier = stats({ entryCount: 3, totalHours: 20, previousTotal: 10 });
    expect(milestoneFor(busier, new Set(["first-entry"]))?.id).toBe("beat-previous");
  });

  it("does not claim an improvement when there is nothing to compare against", () => {
    const noHistory = stats({ entryCount: 3, totalHours: 20, previousTotal: 0 });
    expect(milestoneFor(noHistory, new Set(["first-entry"]))).toBeNull();
  });
});

describe("wryLine", () => {
  it("holds the same line all day and changes the next", () => {
    const morning = wryLine(new Date("2026-08-31T08:00:00Z"));
    const evening = wryLine(new Date("2026-08-31T20:00:00Z"));
    const tomorrow = wryLine(new Date("2026-09-01T08:00:00Z"));

    expect(morning).toBe(evening);
    expect(tomorrow).not.toBe(morning);
  });

  it("always returns a line", () => {
    for (let day = 0; day < 30; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + day));
      expect(wryLine(date).length).toBeGreaterThan(10);
    }
  });
});
