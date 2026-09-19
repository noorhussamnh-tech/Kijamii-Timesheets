/**
 * Assumed dedication against actual.
 *
 * Two shapes over the same rows. The whole book -- one line per person per
 * team, in the OPS employee list's own column order, to be pasted beside it
 * month after month. And one team at a time, for the conversation that is
 * actually had: who is meant to be on this account, and who was.
 *
 * Both sides are measured against the same month of capacity, 140 hours, so
 * Assumed Hours and Actual Hours subtract straight from each other and Actual
 * Dedication % falls short when somebody logs short. Dividing by what they
 * actually logged instead would always total 100%, which would make a person
 * who logged twenty hours in a month look perfectly distributed.
 *
 * 140 is one month, and the range says how many of them there are: a quarter
 * is 420, half of September is 70. Exact for whole months, proportional for
 * anything else. Both columns use the same figure, so they stay subtractable
 * whatever period is chosen.
 */
import type { TeamDedicationRow } from "@/lib/data/api";
import type { Shaped } from "@/lib/export/time-dedication";

const num = (value: number | string | null): string =>
  value === null || value === "" ? "" : String(Math.round(Number(value) * 100) / 100);

const pct = (value: number | string | null): string =>
  value === null || value === "" ? "" : `${Math.round(Number(value) * 10) / 10}%`;

const byName = (a: TeamDedicationRow, b: TeamDedicationRow) =>
  (a.full_name ?? "").localeCompare(b.full_name ?? "", undefined, { sensitivity: "base" });

/** Every team, every person on one: the file that lines up with the sheet. */
export function teamDedicationView(rows: readonly TeamDedicationRow[]): Shaped {
  return {
    headers: [
      "Name",
      "Email",
      "Entity",
      "Business Unit",
      "Sub-Unit",
      "Function",
      "Manager",
      "Team",
      "Assumed Hours",
      "Assumed %",
      "Actual Hours",
      "Actual %",
    ],
    rows: rows.map((row) => [
      row.full_name ?? "",
      row.email,
      row.entity ?? "",
      row.business_unit ?? "",
      row.sub_unit ?? "",
      row.job_function ?? "",
      row.manager ?? "",
      row.team,
      num(row.assumed_hours),
      pct(row.assumed_pct),
      num(row.actual_hours),
      pct(row.actual_pct),
    ]),
  };
}

/** The distinct teams present, for the picker. */
export const teamsIn = (rows: readonly TeamDedicationRow[]): string[] =>
  [...new Set(rows.map((row) => row.team))].sort();

/**
 * One team: everybody with any assumed dedication to it, however small.
 *
 * Five percent is still a claim on somebody's month, and the person on a team
 * for five percent is exactly who gets forgotten when the account is being
 * staffed -- so the cut is "any", not "meaningful".
 *
 * Anybody who logged hours against the team without being staffed on it is
 * kept too, with a blank assumed figure. That is not noise: somebody working
 * on an account nobody planned for them is the finding this file exists to
 * surface, and dropping them would hide it.
 */
export function teamRosterView(rows: readonly TeamDedicationRow[], team: string): Shaped {
  const mine = rows
    .filter((row) => row.team === team)
    .filter((row) => Number(row.assumed_pct ?? 0) > 0 || Number(row.actual_hours ?? 0) > 0)
    .sort(byName);

  return {
    headers: [
      "Name",
      "Email",
      "Entity",
      "Business Unit",
      "Sub Unit",
      "Function",
      "Manager",
      "Assumed Hours",
      "Assumed Percentage",
      "Actual Hours",
      "Actual Percentage",
    ],
    rows: mine.map((row) => [
      row.full_name ?? "",
      row.email,
      row.entity ?? "",
      row.business_unit ?? "",
      row.sub_unit ?? "",
      row.job_function ?? "",
      row.manager ?? "",
      num(row.assumed_hours),
      pct(row.assumed_pct),
      num(row.actual_hours),
      pct(row.actual_pct),
    ]),
  };
}
