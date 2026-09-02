import { describe, expect, it } from "vitest";

import { sectionedCsv } from "@/lib/export/csv";

describe("sectionedCsv", () => {
  it("keeps each section's own header row and separates them with a blank line", () => {
    const csv = sectionedCsv([
      { title: "Summary", headers: ["a", "b"], rows: [[1, 2]] },
      { title: "Per day", headers: ["date", "hours"], rows: [["2026-09-01", 4]] },
    ]);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe("# Summary");
    expect(lines[1]).toBe("a,b");
    expect(lines[2]).toBe("1,2");
    expect(lines[3]).toBe("");
    expect(lines[4]).toBe("# Per day");
    expect(lines[5]).toBe("date,hours");
  });

  it("says a section is empty rather than dropping it", () => {
    const csv = sectionedCsv([
      { title: "Per title", headers: ["title"], rows: [] },
      { title: "Per day", headers: ["date"], rows: [["2026-09-01"]] },
    ]);

    expect(csv).toContain("# Per title");
    expect(csv).toContain("Nothing to show for this view.");
    expect(csv).toContain("# Per day");
  });

  it("still escapes a value that would otherwise run as a formula", () => {
    const csv = sectionedCsv([{ title: "X", headers: ["h"], rows: [["=SUM(A1:A9)"]] }]);
    expect(csv).not.toMatch(/\n=SUM/);
  });
});
