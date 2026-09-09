/**
 * The views of one person's logged time.
 *
 * All of them fold the same rows, which is the point: a total that disagreed
 * with the days beneath it, or a per-account column that did not add up to the
 * per-day one, would be worse than having no report at all. Anything summed
 * here is summed from the same list.
 */
import { parseDateKey, weekKeyOf, weekRangeLabel } from "@/lib/domain/week";
import type { Shaped } from "@/lib/export/time-dedication";

export interface DetailRow {
  employeeId: string;
  employeeName: string;
  /** Job title. The employee list calls this Position. */
  title: string | null;
  /** The craft above the title -- Art, Copywriting, Account Management. */
  jobFunction: string | null;
  department: string | null;
  /** Straight from the company employee list, for reporting only. */
  businessUnit: string | null;
  subUnit: string | null;
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
const clientOf = (row: DetailRow) => row.clientName ?? "Unnamed";

/**
 * Hours grouped by one attribute of the row: title, function, business unit,
 * sub-unit, project type.
 *
 * One fold rather than five near-identical ones. They differ only in which
 * field they read and what to call a row that has not got one, and writing
 * them out separately would have meant five places to fix a rounding rule or
 * a sort order -- and five chances to fix four of them.
 *
 * Rows with nothing in the field are grouped under a name rather than dropped,
 * so every one of these views still totals the same as the others and the gap
 * is visible instead of silent.
 */
function byAttribute(
  rows: readonly DetailRow[],
  header: string,
  pick: (row: DetailRow) => string | null,
  unset: string,
): Shaped {
  const keyOf = (row: DetailRow) => pick(row)?.trim() || unset;
  const hours = sumBy(rows, keyOf);
  const people = collect(rows, keyOf, (row) => row.employeeId);
  const total = [...hours.values()].reduce((sum, value) => sum + value, 0);

  return {
    headers: [header, "people", "hours", "share"],
    rows: [...hours.entries()]
      // Alphabetical where the hours tie, so the same data always produces the
      // same file rather than whatever order the rows happened to arrive in.
      .sort((a, b) => b[1] - a[1] || byText(a[0], b[0]))
      .map(([name, value]) => [
        name,
        people.get(name)?.size ?? 0,
        round(value),
        total > 0 ? `${Math.round((value / total) * 100)}%` : "0%",
      ]),
  };
}

/** Hours by job title -- Position, in the employee list's words. */
export const perPositionView = (rows: readonly DetailRow[]): Shaped =>
  byAttribute(rows, "position", (row) => row.title, "No position set");

/** Hours by craft. */
export const perFunctionView = (rows: readonly DetailRow[]): Shaped =>
  byAttribute(rows, "function", (row) => row.jobFunction, "No function set");

/** Hours by business unit, as the employee list has it. */
export const perBusinessUnitView = (rows: readonly DetailRow[]): Shaped =>
  byAttribute(rows, "business_unit", (row) => row.businessUnit, "Not in the employee list");

/** Hours by sub-unit -- the team inside a business unit. */
export const perSubUnitView = (rows: readonly DetailRow[]): Shaped =>
  byAttribute(rows, "sub_unit", (row) => row.subUnit, "Not in the employee list");

/** Hours by what the work was: Campaign, Reels, Pitch (Retainer). */
export const perProjectTypeView = (rows: readonly DetailRow[]): Shaped =>
  byAttribute(rows, "project_type", (row) => row.projectType, "None set");

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
        clientOf(row),
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
  const clients = collect(rows, (row) => row.employeeId, clientOf);

  return {
    headers: [
      "employee",
      "title",
      "department",
      "total_hours",
      "days_logged",
      "clients",
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
          clients.get(person.id)?.size ?? 0,
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

/**
 * One line per person per week they logged anything.
 *
 * Weeks are anchored to the Sunday they start on, the same anchor the
 * timesheet itself uses, so a week here is the same seven days the person
 * filled in rather than an ISO week that starts on a different day and makes
 * the totals impossible to reconcile against what they submitted.
 */
export function perWeekView(rows: readonly DetailRow[]): Shaped {
  const hours = sumBy(rows, (row) => key(row.employeeName, weekKeyOf(parseDateKey(row.workDate))));
  return {
    headers: ["employee", "week_starting", "week", "hours"],
    rows: [...hours.entries()]
      .map(([k, value]) => {
        const [name, week] = unkey(k);
        return [name!, week!, weekRangeLabel(week!), round(value)];
      })
      .sort((a, b) => byText(a[0], b[0]) || byText(a[1], b[1])),
  };
}

/**
 * One line per person per calendar month.
 *
 * Written as `2026-09` rather than "September 2026" so a spreadsheet sorts it
 * correctly without anybody having to reformat the column first.
 */
export function perMonthView(rows: readonly DetailRow[]): Shaped {
  const hours = sumBy(rows, (row) => key(row.employeeName, row.workDate.slice(0, 7)));
  return {
    headers: ["employee", "month", "hours"],
    rows: [...hours.entries()]
      .map(([k, value]) => {
        const [name, month] = unkey(k);
        return [name!, month!, round(value)];
      })
      .sort((a, b) => byText(a[0], b[0]) || byText(a[1], b[1])),
  };
}

/** One line per person per client, with each client's share of their time. */
export function perClientView(rows: readonly DetailRow[]): Shaped {
  const hours = sumBy(rows, (row) => key(row.employeeName, clientOf(row)));
  const perPerson = sumBy(rows, (row) => row.employeeName);

  return {
    headers: ["employee", "client", "hours", "share_of_their_time"],
    rows: [...hours.entries()]
      .map(([k, value]) => {
        const [name, client] = unkey(k);
        const total = perPerson.get(name!) ?? 0;
        return [
          name!,
          client!,
          round(value),
          total > 0 ? `${Math.round((value / total) * 100)}%` : "0%",
        ];
      })
      // Biggest client first within each person, which is the order somebody
      // asking "where did their month go" actually reads in.
      .sort((a, b) => byText(a[0], b[0]) || Number(b[2]) - Number(a[2])),
  };
}

/**
 * A grid: clients down the side, days across the top.
 *
 * Only days that were logged become columns. A month of mostly empty columns
 * is harder to read than the same data without them, and the missing dates are
 * exactly what the per-day view already reports.
 */
export function perClientByDayView(rows: readonly DetailRow[]): Shaped {
  const dates = [...new Set(rows.map((row) => row.workDate))].sort();
  const cells = sumBy(rows, (row) => key(row.employeeName, clientOf(row), row.workDate));
  const pairs = [...new Set(rows.map((row) => key(row.employeeName, clientOf(row))))].sort();

  return {
    headers: ["employee", "client", ...dates, "total"],
    rows: pairs.map((pair) => {
      const [name, client] = unkey(pair);
      const daily = dates.map((date) => round(cells.get(key(pair, date)) ?? 0));
      return [name!, client!, ...daily, round(daily.reduce((sum, value) => sum + value, 0))];
    }),
  };
}
