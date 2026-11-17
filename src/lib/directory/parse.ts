/**
 * The OPS employee list, as the database wants it.
 *
 * The sheet is written by people, so this reads it the way a person would
 * rather than the way a tidy export would: columns are found by their heading
 * instead of their position, a person spread over several rows is folded into
 * one, and a blank cell on one of those rows does not erase what another row
 * says. What it will not do is guess -- a row it cannot make sense of is
 * returned as a problem with its line number, because the alternative is a
 * directory that is quietly wrong.
 *
 * The real checks live in the database, where they cannot be skipped by
 * calling the RPC directly. These are here so somebody looking at the file
 * gets told which line to fix.
 */

export interface DirectoryPerson {
  email: string;
  full_name: string;
  business_unit: string | null;
  sub_unit: string | null;
  function: string | null;
  manager: string | null;
  entity: string | null;
}

export interface DirectoryDedication {
  email: string;
  team: string;
  pct: number;
}

export interface ParseProblem {
  line: number;
  detail: string;
  /**
   * Whether this stops the import or only the row.
   *
   * The two are genuinely different and treating them alike makes the whole
   * feature useless: the OPS list permanently contains people with no company
   * address -- security, runners, an office boy -- who cannot hold a timesheet
   * and never will. If their rows blocked the load, it would never once
   * succeed. They are skipped and counted. What blocks is a list that
   * contradicts itself, because importing half of that is how a directory goes
   * quietly wrong.
   */
  blocking: boolean;
}

export interface ParsedDirectory {
  people: DirectoryPerson[];
  dedication: DirectoryDedication[];
  problems: ParseProblem[];
  /** Data rows read, before folding several rows of one person into one. */
  rowsRead: number;
}

/** RFC 4180 enough for a Google Sheets export: quotes, commas, newlines. */
export function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  // A byte-order mark survives the round trip through Sheets and would
  // otherwise become part of the first heading.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // \r\n is one break, not two.
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const clean = (value: string | undefined): string => (value ?? "").replace(/\s+/g, " ").trim();

/** Heading synonyms, so a renamed column does not silently empty a field. */
const COLUMNS: Record<string, string[]> = {
  full_name: ["name", "employee", "employee name", "full name", "x"],
  email: ["email", "e-mail", "email address"],
  entity: ["entity"],
  business_unit: ["business unit", "businessunit", "bu"],
  sub_unit: ["sub-unit", "sub unit", "subunit"],
  function: ["function", "job function"],
  manager: ["manager", "reports to", "line manager"],
  team: ["team", "account team"],
  pct: ["dedication %", "dedication", "dedication percent", "%"],
};

function findHeader(rows: string[][]): { index: number; map: Record<string, number> } | null {
  // The heading is not always the first line: the sheet has carried a title
  // row above it before now.
  for (let r = 0; r < Math.min(rows.length, 10); r += 1) {
    const cells = rows[r]!.map((c) => clean(c).toLowerCase());
    const map: Record<string, number> = {};
    for (const [field, names] of Object.entries(COLUMNS)) {
      const at = cells.findIndex((c) => names.includes(c));
      if (at >= 0) map[field] = at;
    }
    // Email is the key the whole import hangs on; a row without it is not the
    // heading however much else it matches.
    if (map["email"] !== undefined && Object.keys(map).length >= 3) {
      return { index: r, map };
    }
  }
  return null;
}

/** A percentage as the sheet writes it: "77%", "77", "0.77" all mean 77. */
function readPct(raw: string): number | null {
  const text = clean(raw).replace("%", "").trim();
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  // A sheet that formats the column as a percentage exports 0.77 rather than
  // 77. Treated as a fraction only below 1, so a real 0.5% is not inflated to
  // 50 -- nobody is staffed at half a percent, and a whole number never is.
  const pct = n > 0 && n < 1 ? n * 100 : n;
  return Math.round(pct * 100) / 100;
}

export function parseDirectoryCsv(text: string): ParsedDirectory {
  const rows = readCsv(text);
  const header = findHeader(rows);
  if (!header) {
    return {
      people: [],
      dedication: [],
      rowsRead: 0,
      problems: [
        {
          line: 1,
          blocking: true,
          detail:
            "No heading row found. The file needs a row naming at least Email, " +
            "plus two of Name, Manager, Team, Function.",
        },
      ],
    };
  }

  const { index, map } = header;
  const at = (cells: string[], field: string): string =>
    map[field] === undefined ? "" : clean(cells[map[field]!]);

  const byEmail = new Map<string, DirectoryPerson>();
  const dedication: DirectoryDedication[] = [];
  const problems: ParseProblem[] = [];
  let rowsRead = 0;

  for (let r = index + 1; r < rows.length; r += 1) {
    const cells = rows[r]!;
    // Sheets pads the grid out with empty rows; they are not a defect.
    if (cells.every((c) => clean(c) === "")) continue;
    rowsRead += 1;
    const line = r + 1;

    const email = at(cells, "email").toLowerCase();
    const name = at(cells, "full_name");

    if (email === "" || email === "n/a") {
      problems.push({
        line,
        blocking: false,
        detail: name === "" ? "No email and no name." : `${name} has no email address.`,
      });
      continue;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      problems.push({ line, blocking: false, detail: `"${email}" is not an email address.` });
      continue;
    }

    const existing = byEmail.get(email);
    if (!existing) {
      if (name === "") {
        problems.push({ line, blocking: false, detail: `${email} has no name on its first row.` });
        continue;
      }
      byEmail.set(email, {
        email,
        full_name: name,
        business_unit: at(cells, "business_unit") || null,
        sub_unit: at(cells, "sub_unit") || null,
        function: at(cells, "function") || null,
        manager: at(cells, "manager") || null,
        entity: at(cells, "entity") || null,
      });
    } else {
      // A person spread over several rows. A later row fills a gap but never
      // overwrites an answer, and a name that disagrees is reported rather
      // than picked between -- that is how two people end up sharing one
      // record.
      if (name !== "" && name !== existing.full_name) {
        problems.push({
          line,
          blocking: true,
          detail: `${email} is given as both "${existing.full_name}" and "${name}".`,
        });
      }
      existing.business_unit ??= at(cells, "business_unit") || null;
      existing.sub_unit ??= at(cells, "sub_unit") || null;
      existing.function ??= at(cells, "function") || null;
      existing.manager ??= at(cells, "manager") || null;
      existing.entity ??= at(cells, "entity") || null;
    }

    const team = at(cells, "team");
    if (team !== "") {
      const pct = readPct(at(cells, "pct"));
      if (pct === null) {
        problems.push({
          line,
          blocking: false,
          detail: `${name || email} is on ${team} with no dedication %.`,
        });
      } else if (pct < 0 || pct > 100) {
        problems.push({
          line,
          blocking: true,
          detail: `${name || email} is on ${team} at ${pct}%.`,
        });
      } else {
        dedication.push({ email, team, pct });
      }
    }
  }

  // Said here as well as in the database, because a line number is only
  // available on this side of the wire.
  const totals = new Map<string, number>();
  for (const d of dedication) totals.set(d.email, (totals.get(d.email) ?? 0) + d.pct);
  for (const [email, total] of totals) {
    if (total > 100.009) {
      problems.push({
        line: 0,
        blocking: true,
        detail: `${byEmail.get(email)?.full_name ?? email} totals ${Math.round(total)}% across their teams.`,
      });
    }
  }

  return { people: [...byEmail.values()], dedication, problems, rowsRead };
}
