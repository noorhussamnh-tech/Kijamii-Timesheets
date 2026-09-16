import { describe, expect, it } from "vitest";

import type { MonthCoverage } from "@/lib/domain/coverage";
import { dailyNote, NOTE_SETS, pickForDay } from "@/lib/domain/daily-note";

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
  });

  it("does not call anybody behind on the first days of a month", () => {
    const note = dailyNote(
      coverage({ workingDaysSoFar: 1, missing: ["2026-09-01"], completion: 0 }),
      DAY,
    );
    expect(note.tone).toBe("invite");
  });

  it("invites rather than scolds when nothing is logged", () => {
    const note = dailyNote(
      coverage({ workingDaysSoFar: 8, missing: Array(8).fill("d"), completion: 0 }),
      DAY,
    );
    expect(note.tone).toBe("invite");
  });

  it("celebrates a month with nothing missing", () => {
    const note = dailyNote(
      coverage({ workingDaysSoFar: 11, logged: Array(11).fill("d"), completion: 1 }),
      DAY,
    );
    expect(note.tone).toBe("praise");
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

describe("the line changes every day and does not repeat", () => {
  const day = (n: number) => new Date(n * 86_400_000);

  it("gives every line in a set exactly one turn before any of them comes back", () => {
    for (const [name, lines] of Object.entries(NOTE_SETS)) {
      const lap = Array.from({ length: lines.length }, (_, i) => pickForDay(lines, day(i)));
      expect(new Set(lap).size, `${name} repeats within a single lap`).toBe(lines.length);
    }
  });

  it("shuffles the order again on the next lap, so the sequence is not learnable", () => {
    // Not a cosmetic point: walking a fixed order makes the set read as a
    // short loop, which is the thing a rotating line exists to avoid.
    const lines = NOTE_SETS.KEEPING_UP;
    const first = Array.from({ length: lines.length }, (_, i) => pickForDay(lines, day(i)));
    const second = Array.from({ length: lines.length }, (_, i) =>
      pickForDay(lines, day(lines.length + i)),
    );
    expect(second).not.toEqual(first);
    expect(new Set(second).size).toBe(lines.length);
  });

  it("is stable within a day and different the next", () => {
    const lines = NOTE_SETS.BEHIND;
    const morning = new Date("2026-09-16T08:00:00Z");
    const evening = new Date("2026-09-16T21:30:00Z");
    const tomorrow = new Date("2026-09-17T08:00:00Z");

    expect(pickForDay(lines, evening)).toBe(pickForDay(lines, morning));
    expect(pickForDay(lines, tomorrow)).not.toBe(pickForDay(lines, morning));
  });

  it("indexes forwards for dates before the epoch rather than off the end", () => {
    const lines = NOTE_SETS.COMPLETE;
    expect(lines).toContain(pickForDay(lines, new Date("1969-07-20T00:00:00Z")));
  });

  it("gives the half-done month a set rather than one sentence", () => {
    // The state that was on screen every morning with the same words. Every
    // other state had the same problem; this is the one that was reported.
    const seen = new Set(
      Array.from(
        { length: NOTE_SETS.KEEPING_PACE.length },
        (_, i) =>
          dailyNote(
            coverage({
              workingDaysSoFar: 11,
              logged: Array(6).fill("d"),
              missing: ["a", "b", "c", "d", "e"],
              completion: 0.55,
            }),
            day(i),
          ).text,
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("the promises every line has to keep", () => {
  const ALL = Object.entries(NOTE_SETS).flatMap(([set, lines]) =>
    lines.map((line) => ({
      set,
      text:
        typeof line.text === "function"
          ? line.text(
              coverage({
                workingDaysSoFar: 11,
                logged: Array(6).fill("d"),
                missing: ["a", "b", "c", "d", "e"],
                completion: 0.55,
              }),
            )
          : line.text,
      emoji: line.emoji,
    })),
  );

  it("never scolds, in any state", () => {
    // The rule the whole file exists to keep. Worth checking across every
    // line rather than the handful a branch test happens to reach, because
    // the one that slips in will be in a set nobody wrote a test for.
    for (const line of ALL) {
      expect(line.text.toLowerCase(), `${line.set}: "${line.text}"`).not.toMatch(
        // Word boundaries matter here: without them "late" matches inside
        // "clean slate", which is one of the warmest lines in the file.
        /\b(behind|missed|failed|overdue|late|forgot|neglected)\b|should have/,
      );
    }
  });

  it("never names the size of the pile to somebody who is behind", () => {
    // Counting what is open is encouraging at half a month and dispiriting at
    // a fortnight. The behind set points at one day instead.
    for (const line of NOTE_SETS.BEHIND) {
      expect(typeof line.text).toBe("string");
    }
  });

  it("gives every line an emoji and a sentence", () => {
    for (const line of ALL) {
      expect(line.emoji.length, `${line.set} has a line with no emoji`).toBeGreaterThan(0);
      expect(line.text.trim().length, `${line.set} has an empty line`).toBeGreaterThan(10);
    }
  });

  it("has enough lines in every set that a month rarely repeats one", () => {
    for (const [set, lines] of Object.entries(NOTE_SETS)) {
      expect(lines.length, `${set} is too small to last a month`).toBeGreaterThanOrEqual(7);
    }
  });
});
