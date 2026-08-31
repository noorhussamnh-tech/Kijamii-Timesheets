import { describe, expect, it } from "vitest";

import type { MonthCoverage } from "@/lib/domain/coverage";
import { dailyNote } from "@/lib/domain/daily-note";

function coverage(overrides: Partial<MonthCoverage> = {}): MonthCoverage {
  return {
    missing: [],
    logged: [],
    workingDaysSoFar: 0,
    completion: 0,
    ...overrides,
  };
}

const DAY = new Date("2026-09-15T09:00:00Z");

describe("dailyNote", () => {
  it("opens a month that has not started without asking for anything", () => {
    const note = dailyNote(coverage(), DAY);
    expect(note.tone).toBe("invite");
    expect(note.text).toMatch(/fresh month/i);
  });

  it("invites rather than scolds when nothing is logged", () => {
    const note = dailyNote(
      coverage({ workingDaysSoFar: 8, missing: Array(8).fill("d"), completion: 0 }),
      DAY,
    );
    expect(note.tone).toBe("invite");
    expect(note.text).toMatch(/easiest day to start/i);
  });

  it("celebrates a month with nothing missing", () => {
    const note = dailyNote(
      coverage({ workingDaysSoFar: 11, logged: Array(11).fill("d"), completion: 1 }),
      DAY,
    );
    expect(note.tone).toBe("praise");
    expect(note.text).toContain("11");
  });

  it("saves the jokes for people who are keeping up", () => {
    const note = dailyNote(
      coverage({
        workingDaysSoFar: 10,
        logged: Array(9).fill("d"),
        missing: ["2026-09-14"],
        completion: 0.9,
      }),
      DAY,
    );
    expect(note.tone).toBe("praise");
  });

  it("counts what is open, without a verdict, in the middle", () => {
    const note = dailyNote(
      coverage({
        workingDaysSoFar: 10,
        logged: Array(6).fill("d"),
        missing: ["a", "b", "c", "d"],
        completion: 0.6,
      }),
      DAY,
    );
    expect(note.tone).toBe("steady");
    expect(note.text).toContain("4 days");
  });

  it("points at one next step rather than the backlog when far behind", () => {
    const note = dailyNote(
      coverage({
        workingDaysSoFar: 15,
        logged: ["a"],
        missing: Array(14).fill("d"),
        completion: 0.07,
      }),
      DAY,
    );
    expect(note.tone).toBe("invite");
    expect(note.text).toMatch(/most recent/i);
    // Never states the size of the backlog, and never blames.
    expect(note.text).not.toContain("14");
    expect(note.text.toLowerCase()).not.toMatch(/behind|missed|failed|should/);
  });

  it("holds one joke all day and changes it the next", () => {
    const keepingUp = coverage({
      workingDaysSoFar: 10,
      logged: Array(9).fill("d"),
      missing: ["x"],
      completion: 0.9,
    });
    const morning = dailyNote(keepingUp, new Date("2026-09-15T07:00:00Z"));
    const evening = dailyNote(keepingUp, new Date("2026-09-15T19:00:00Z"));
    const tomorrow = dailyNote(keepingUp, new Date("2026-09-16T07:00:00Z"));

    expect(morning.text).toBe(evening.text);
    expect(tomorrow.text).not.toBe(morning.text);
  });

  it("always carries an emoji", () => {
    for (const completion of [0, 0.3, 0.6, 0.9, 1]) {
      const note = dailyNote(
        coverage({
          workingDaysSoFar: 10,
          logged: Array(Math.round(completion * 10)).fill("d"),
          missing: Array(10 - Math.round(completion * 10)).fill("d"),
          completion,
        }),
        DAY,
      );
      expect(note.emoji.length).toBeGreaterThan(0);
    }
  });
});
