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

  it("celebrates each of the first three entries, in order", () => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const count of [1, 2, 3]) {
      const next = milestoneFor(stats({ entryCount: count }), seen);
      ids.push(next!.id);
      seen.add(next!.id);
    }
    expect(ids).toEqual(["first-entry", "second-entry", "third-entry"]);
  });

  it("stops celebrating individual entries after the third", () => {
    const seen = new Set(["first-entry", "second-entry", "third-entry"]);
    expect(milestoneFor(stats({ entryCount: 9 }), seen)).toBeNull();
  });

  it("fires one at a time, and the opening beats a streak", () => {
    const rich = stats({ entryCount: 40, daysLogged: 22, longestStreak: 22, totalHours: 100 });
    // Somebody just starting hears about starting, not about a 20-day streak.
    expect(milestoneFor(rich, none)?.id).toBe("first-entry");

    // Past the opening, the rarest thing wins and nothing is lost on the way.
    const opened = new Set(["first-entry", "second-entry", "third-entry"]);
    const first = milestoneFor(rich, opened);
    expect(first?.id).toBe("streak-20");
    expect(milestoneFor(rich, new Set([...opened, first!.id]))?.id).toBe("streak-5");
  });

  it("treats a full week of logging as its own milestone", () => {
    const week = stats({ entryCount: 9, daysLogged: 5 });
    const opened = new Set(["first-entry", "second-entry", "third-entry"]);
    expect(milestoneFor(week, opened)?.id).toBe("full-week");
  });

  it("celebrates beating the previous period, but ranks it last", () => {
    const busier = stats({ entryCount: 3, totalHours: 20, previousTotal: 10 });
    const opened = new Set(["first-entry", "second-entry", "third-entry"]);
    expect(milestoneFor(busier, opened)?.id).toBe("beat-previous");
  });

  it("does not claim an improvement when there is nothing to compare against", () => {
    const noHistory = stats({ entryCount: 3, totalHours: 20, previousTotal: 0 });
    const opened = new Set(["first-entry", "second-entry", "third-entry"]);
    expect(milestoneFor(noHistory, opened)).toBeNull();
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
