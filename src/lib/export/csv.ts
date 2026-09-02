/**
 * CSV generation.
 *
 * Spreadsheets are the destination for these files, so the same
 * formula-injection rule that guards the Google Sheets export applies here:
 * a project note beginning `=` would otherwise execute the moment somebody
 * double-clicks the download.
 */
import { escapeSpreadsheetValue } from "@/lib/sheets/escape";

/** Quotes a field only when it needs it, doubling any embedded quotes. */
function quoteField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: readonly string[], rows: readonly unknown[][]): string {
  const lines = [headers.map((h) => quoteField(h)).join(",")];
  for (const row of rows) {
    lines.push(row.map((cell) => quoteField(escapeSpreadsheetValue(cell))).join(","));
  }
  // CRLF, because Excel treats a bare LF as one long line on some platforms.
  return lines.join("\r\n");
}

/**
 * Hands the file to the browser.
 *
 * The BOM matters: without it Excel reads UTF-8 as Latin-1 and mangles any
 * non-ASCII name, which for a Kijamii staff list is most of them.
 */
export function downloadCsv(filename: string, csv: string): void {
  // U+FEFF written as an escape rather than a literal, which is invisible.
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Several tables in one file, each under its own heading.
 *
 * CSV has no notion of sheets, so "everything in one download" has to be
 * sections separated by blank lines. Spreadsheets open this happily: each
 * block keeps its own header row, and the titles survive as ordinary cells
 * somebody can read or delete.
 *
 * Sections with no rows are kept, with a line saying so. Silently omitting an
 * empty view would leave the reader wondering whether it was empty or whether
 * the export forgot it.
 */
export function sectionedCsv(
  sections: readonly { title: string; headers: readonly string[]; rows: readonly unknown[][] }[],
): string {
  return sections
    .map((section) => {
      const heading = quoteField(`# ${section.title}`);
      if (section.rows.length === 0) {
        return [heading, quoteField("Nothing to show for this view.")].join("\r\n");
      }
      return [heading, toCsv(section.headers, section.rows)].join("\r\n");
    })
    .join("\r\n\r\n");
}
