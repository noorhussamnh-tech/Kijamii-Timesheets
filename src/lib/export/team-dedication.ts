/**
 * Assumed dedication against actual, in the OPS employee list's own columns.
 *
 * The point of the file is that it lines up with the sheet it came from, so
 * the header row is the sheet's header row with three columns added on the
 * right rather than a tidier set of its own.
 *
 * Both sides are measured against the same month of capacity, 140 hours, so
 * Assumed Hours and Actual Hours subtract straight from each other and Actual
 * Dedication % falls short when somebody logs short. Dividing by what they
 * actually logged instead would always total 100%, which would make a person
 * who logged twenty hours in a month look perfectly distributed.
 *
 * This is a month's export. Over a week or a quarter both figures are
 * measured against the wrong month -- the assumed side is per month by
 * definition, so no denominator rescues a range that is not one.
 */
import type { TeamDedicationRow } from "@/lib/data/api";
import type { Shaped } from "@/lib/export/time-dedication";

const num = (value: number | string | null): string =>
  value === null || value === "" ? "" : String(Math.round(Number(value) * 100) / 100);

const pct = (value: number | string | null): string =>
  value === null || value === "" ? "" : `${Math.round(Number(value) * 10) / 10}%`;

export function teamDedicationView(rows: readonly TeamDedicationRow[]): Shaped {
  return {
    headers: [
      "Name",
      "Email",
      "Business Unit",
      "Sub-Unit",
      "Function",
      "Manager",
      "Team",
      "Dedication %",
      "Assumed Hours",
      "Actual Hours",
      "Actual Dedication %",
    ],
    rows: rows.map((row) => [
      row.full_name ?? "",
      row.email,
      row.business_unit ?? "",
      row.sub_unit ?? "",
      row.job_function ?? "",
      row.manager ?? "",
      row.team,
      pct(row.assumed_pct),
      num(row.assumed_hours),
      num(row.actual_hours),
      pct(row.actual_pct),
    ]),
  };
}
