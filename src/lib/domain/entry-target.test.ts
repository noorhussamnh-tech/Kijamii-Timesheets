import { describe, expect, it } from "vitest";

import { defaultEntryDateFor } from "./entry-target";

describe("where a new row lands", () => {
  const week = ["2026-08-23", "2026-08-24", "2026-08-25", "2026-08-26"];

  it("uses today when today is part of the week", () => {
    expect(defaultEntryDateFor("2026-08-26", week)).toBe("2026-08-26");
  });

  it("still uses today when that day has already been submitted", () => {
    // A submitted day accepts new rows; only the rows already sent are frozen.
    expect(defaultEntryDateFor("2026-08-26", week)).toBe("2026-08-26");
  });

  it("never returns a day outside the week", () => {
    // A row dated outside the week it is filed under is refused by the
    // database, so the search stays within the week.
    expect(defaultEntryDateFor("2026-09-01", week)).toBe("2026-08-26");
  });

  it("returns null for a week with no days available", () => {
    expect(defaultEntryDateFor("2026-08-30", [])).toBeNull();
  });

  it("uses the last day of a week that has fully passed", () => {
    const full = [...week, "2026-08-27", "2026-08-28", "2026-08-29"];
    expect(defaultEntryDateFor("2026-09-05", full)).toBe("2026-08-29");
  });
});
