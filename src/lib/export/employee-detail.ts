/**
 * The five views of one person's logged time.
 *
 * All of them fold the same rows, which is the point: a total that disagreed
 * with the days beneath it, or a per-account column that did not add up to the
 * per-day one, would be worse than having no report at all. Anything summed
 * here is summed from the same list.
 */
import type { Shaped } from "@/lib/export/time-dedication";

export interface DetailRow {
  employeeId: string;
  employeeName: string;
  title: string | null;
  department: string | null;
  market: string | null;
  workDate: string;
  clientCode: string | null;
  clientName: string | null;
  projectType: string | null;
  scope: string | null;
  billable: boolean;
  hours: number | string;
}

export interface DetailEmployee {
  id: string;
  name: string;
  email: string;
  title: string | null;
  department: string | null;
  employeeCode: string | null;
  primaryMarket: string | null;
}

/**
 * Joins the parts of a compound key.
 *
 * Written as an escape rather than typed literally: it is a control character,
 * invisible in an editor and rejected by the linter on sight. A plain space
 * would be worse than either -- every employee name in this company contains
 * one, so splitting on it would tear "Noor Hussam" in half.
 */
const SEP = "\u001F";
const key = (...parts: string[]): string => parts.join(SEP);
const unkey = (value: string): string[] => value.split(SEP);

const num = (value: number | string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Rounds to two places, so summed floats do not print as 7.199999999999999. */
const round = (value: number): number => Math.round(value * 100) / 100;

function sumBy(rows: readonly DetailRow[], of: (row: DetailRow) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    const k = of(row);
    out.set(k, (out.get(k) ?? 0) + num(row.hours));
  }
  return out;
}

function collect(
  rows: readonly DetailRow[],
  of: (row: DetailRow) => string,
  value: (row: DetailRow) => string,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const row of rows) {
    const k = of(row);
    let set = out.get(k);
    if (!set) {
      set = new Set();
      out.set(k, set);
    }
    set.add(value(row));
  }
  return out;
}

const byText = (a: unknown, b: unknown) => String(a).localeCompare(String(b));
const accountOf = (row: DetailRow) => row.clientName ?? "Unnamed";

/**
 * One line per logged entry: the whole thing, unaggregated.
 *
 * This is the shape to reach for first. Every other view here is a fold of
 * these rows, so anybody with a pivot table can rebuild all of them from this
 * one file in about a minute -- and can also ask questions none of the five
 * anticipated. Column names match the sheet this feeds rather than the
 * snake_case of the summary views, because it is pasted straight in.
 */
export function fullDetailView(rows: readonly DetailRow[]): Shaped {
  return {
    headers: ["Name", "Day", "Market", "Department", "Title", "Account", "Project", "Hours"],
    rows: [...rows]
      .sort((a, b) => byText(a.employeeName, b.employeeName) || byText(a.workDate, b.workDate))
      .map((row) => [
        row.employeeName,
        row.workDate,
        row.market ?? "",
        row.department ?? "",
        row.title ?? "",
        accountOf(row),
        row.projectType ?? "",
        num(row.hours),
      ]),
  };
}

/** One line per person: the headline figures. */
export function summaryView(rows: readonly DetailRow[], roster: readonly DetailEmployee[]): Shaped {
  const hours = sumBy(rows, (row) => row.employeeId);
  const days = collect(
    rows,
    (row) => row.employeeId,
    (row) => row.workDate,
  );
  const accounts = collect(rows, (row) => row.employeeId, accountOf);

  return {
    headers: [
      "employee",
      "title",
      "department",
      "total_hours",
      "days_logged",
      "accounts",
      "avg_hours_per_logged_day",
    ],
    // From the roster, not from the rows: somebody who logged nothing belongs
    // in this report at zero rather than missing from it.
    rows: [...roster]
      .sort((a, b) => byText(a.name, b.name))
      .map((person) => {
        const total = hours.get(person.id) ?? 0;
        const logged = days.get(person.id)?.size ?? 0;
        return [
          person.name,
          person.title ?? "",
          person.department ?? "",
          round(total),
          logged,
          accounts.get(person.id)?.size ?? 0,
          logged > 0 ? round(total / logged) : 0,
        ];
      }),
  };
}

/** One line per person per day they logged anything. */
export function perDayView(rows: readonly DetailRow[]): Shaped {
  const hours = sumBy(rows, (row) => key(row.employeeName, row.workDate));
  return {
    headers: ["employee", "date", "hours"],
    rows: [...hours.entries()]
      .map(([k, value]) => {
        const [name, date] = unkey(k);
        return [name!, date!, round(value)];
      })
      .sort((a, b) => byText(a[0], b[0]) || byText(a[1], b[1])),
  };
}

/** One line per person per account, with each account's share of their time. */
export function perAccountView(rows: readonly DetailRow[]): Shaped {
  const hours = sumBy(rows, (row) => key(row.employeeName, accountOf(row)));
  const perPerson = sumBy(rows, (row) => row.employeeName);

  return {
    headers: ["employee", "account", "hours", "share_of_their_time"],
    rows: [...hours.entries()]
      .map(([k, value]) => {
        const [name, account] = unkey(k);
        const total = perPerson.get(name!) ?? 0;
        return [
          name!,
          account!,
          round(value),
          total > 0 ? `${Math.round((value / total) * 100)}%` : "0%",
        ];
      })
      // Biggest account first within each person, which is the order somebody
      // asking "where did their month go" actually reads in.
      .sort((a, b) => byText(a[0], b[0]) || Number(b[2]) - Number(a[2])),
  };
}

/**
 * A grid: accounts down the side, days across the top.
 *
 * Only days that were logged become columns. A month of mostly empty columns
 * is harder to read than the same data without them, and the missing dates are
 * exactly what the per-day view already reports.
 */
export function perAccountByDayView(rows: readonly DetailRow[]): Shaped {
  const dates = [...new Set(rows.map((row) => row.workDate))].sort();
  const cells = sumBy(rows, (row) => key(row.employeeName, accountOf(row), row.workDate));
  const pairs = [...new Set(rows.map((row) => key(row.employeeName, accountOf(row))))].sort();

  return {
    headers: ["employee", "account", ...dates, "total"],
    rows: pairs.map((pair) => {
      const [name, account] = unkey(pair);
      const daily = dates.map((date) => round(cells.get(key(pair, date)) ?? 0));
      return [name!, account!, ...daily, round(daily.reduce((sum, value) => sum + value, 0))];
    }),
  };
}

/**
 * Hours by job title.
 *
 * Titles are loaded by an admin and may not be set yet. People without one are
 * grouped under "No title set" rather than dropped, so this view still totals
 * the same as every other and the gap is visible instead of silent.
 */
export function perTitleView(rows: readonly DetailRow[]): Shaped {
  const titleOf = (row: DetailRow) => row.title?.trim() || "No title set";
  const hours = sumBy(rows, titleOf);
  const people = collect(rows, titleOf, (row) => row.employeeId);
  const total = [...hours.values()].reduce((sum, value) => sum + value, 0);

  return {
    headers: ["title", "people", "hours", "share"],
    rows: [...hours.entries()]
      // Alphabetical where the hours tie, so the same data always produces the
      // same file rather than whatever order the rows happened to arrive in.
      .sort((a, b) => b[1] - a[1] || byText(a[0], b[0]))
      .map(([title, value]) => [
        title,
        people.get(title)?.size ?? 0,
        round(value),
        total > 0 ? `${Math.round((value / total) * 100)}%` : "0%",
      ]),
  };
}
