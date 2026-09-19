/**
 * Assumed dedication against actual, in the OPS employee list's own columns.
 *
 * The point of the file is that it lines up with the sheet it came from, so
 * the header row is the sheet's header row with three columns added on the
 * right rather than a tidier set of its own.
 *
 * "Actual %" is the team's share of what that person logged in the period,
 * not of a contracted week. That is what makes it comparable with an assumed
 * split, which is also a share of one person totalling 100%. Somebody who
 * logged nothing in the period gets a blank rather than a nought, because
 * nought reads as "did none of this work" when it means "we do not know".
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
      "Actual Hours",
      "Actual %",
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
      num(row.actual_hours),
      pct(row.actual_pct),
    ]),
  };
}
