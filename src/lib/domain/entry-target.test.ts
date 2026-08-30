import { describe, expect, it } from "vitest";

import { defaultEntryDateFor } from "./entry-target";

const none = () => false;

describe("where a new row lands", () => {
  const week = ["2026-08-23", "2026-08-24", "2026-08-25", "2026-08-26"];

  it("uses today when today is open", () => {
    expect(defaultEntryDateFor("2026-08-26", week, none)).toBe("2026-08-26");
  });

  it("falls back to the latest open day when today is locked", () => {
    const locked = (d: string) => d === "2026-08-26";
    expect(defaultEntryDateFor("2026-08-26", week, locked)).toBe("2026-08-25");
  });

  it("never returns a day outside the week", () => {
    // The bug: searching a month-wide list returned a date in another week,
    // which the database refuses because an entry belongs to its own week.
    const allLocked = () => true;
    expect(defaultEntryDateFor("2026-08-26", week, allLocked)).toBeNull();
  });

  it("returns null when the week's only day is submitted", () => {
    // Sunday 30 Aug: the week has begun, one day has happened, and it is
    // already submitted. There is genuinely nowhere to put a row.
    const locked = (d: string) => d === "2026-08-30";
    expect(defaultEntryDateFor("2026-08-30", ["2026-08-30"], locked)).toBeNull();
  });

  it("skips several locked days to reach an open one", () => {
    const locked = (d: string) => d >= "2026-08-25";
    expect(defaultEntryDateFor("2026-08-26", week, locked)).toBe("2026-08-24");
  });

  it("returns null for a week with no days available yet", () => {
    expect(defaultEntryDateFor("2026-08-30", [], none)).toBeNull();
  });

  it("ignores a focus date that is not part of the week", () => {
    expect(defaultEntryDateFor("2026-09-01", week, none)).toBe("2026-08-26");
  });
});
