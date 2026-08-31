/**
 * Timesheet configurations.
 *
 * Both regions render from the same field list today; the KSA object exists as
 * a distinct configuration so its columns, hour rules or working week can be
 * changed without touching Egypt and UAE. Region-specific behaviour belongs
 * here, never as a branch inside a component.
 *
 * The field *options* (clients, services, project types, tasks) are not in
 * this file: they are operational data and are loaded from the database.
 */
import type { Market, TimesheetConfigId } from "./types";

export type FieldKey =
  "workDate" | "clientId" | "projectType" | "scope" | "projectNote" | "hours" | "billable";

export type FieldKind = "date" | "client" | "reference" | "choice" | "text" | "hours" | "billable";

export interface FieldDef {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  required: boolean;
  /** Which reference list feeds a `reference` field. */
  source?: "services" | "projectTypes" | "taskTypes";
  /**
   * The fixed options of a `choice` field. Unlike a `reference` field these
   * live in the configuration rather than in operational data, because they
   * are a rule the agency sets, not a list that grows.
   */
  choices?: readonly { value: string; label: string }[];
  width: string;
  /** Placeholder shown in the input. */
  hint?: string;
  /** Rendered full-width in the mobile card layout. */
  wide?: boolean;
}

export interface TimesheetConfig {
  id: TimesheetConfigId;
  label: string;
  /** Default only -- the employee's own expected hours override it. */
  expectedWeeklyHours: number;
  hoursStep: number;
  maxHoursPerDay: number;
  /** 0 = Sunday. Used to shade non-working days and compute daily targets. */
  workDays: number[];
  fields: FieldDef[];
}

/**
 * What people actually fill in: Date, Client, Project Type, Scope and Hours,
 * with free-text Notes that nobody has to write.
 *
 * Service is absent because it is no longer a question: it follows from the
 * employee's department, and the database stamps it on save. That makes it a
 * second name for Department rather than a fact of its own -- the cost of
 * asking one fewer question of seventy people every day.
 *
 * There is deliberately no Job field -- Kijamii has no job-numbering system --
 * and no Task field: it asked people to classify work a second time, after
 * Service and Project Type had already said what it was, and the Creative
 * Director asked for it to go. The column stays in the database so what was
 * logged under it is not lost.
 */
const sharedFields: FieldDef[] = [
  { key: "workDate", label: "Date", kind: "date", required: true, width: "w-[150px]" },
  { key: "clientId", label: "Client name", kind: "client", required: true, width: "min-w-[190px]" },
  {
    key: "projectType",
    label: "Project Type",
    kind: "reference",
    source: "projectTypes",
    required: true,
    width: "min-w-[170px]",
  },
  {
    key: "scope",
    label: "Scope",
    kind: "choice",
    required: true,
    width: "min-w-[150px]",
    choices: [
      { value: "in_scope", label: "In Scope" },
      { value: "out_of_scope", label: "Out of Scope" },
    ],
  },
  {
    key: "projectNote",
    label: "Notes",
    kind: "text",
    required: false,
    width: "min-w-[220px]",
    hint: "Optional",
    wide: true,
  },
  { key: "hours", label: "Hours", kind: "hours", required: true, width: "w-[104px]" },
];

export const EG_UAE_CONFIG: TimesheetConfig = {
  id: "EG_UAE",
  label: "Egypt + UAE Timesheet",
  expectedWeeklyHours: 40,
  hoursStep: 0.25,
  maxHoursPerDay: 16,
  // Sunday to Thursday.
  workDays: [0, 1, 2, 3, 4],
  fields: sharedFields,
};

/**
 * KSA configuration. Identical to EG/UAE until Kijamii confirms the
 * differences; keeping it separate means those changes stay isolated.
 */
export const KSA_CONFIG: TimesheetConfig = {
  id: "KSA",
  label: "KSA Timesheet",
  expectedWeeklyHours: 40,
  hoursStep: 0.25,
  maxHoursPerDay: 16,
  workDays: [0, 1, 2, 3, 4],
  fields: sharedFields,
};

export const CONFIGS: Record<TimesheetConfigId, TimesheetConfig> = {
  EG_UAE: EG_UAE_CONFIG,
  KSA: KSA_CONFIG,
};

/** The configuration a market maps to. Mirrors `ts_complete_onboarding`. */
export function configForMarket(market: Market | null): TimesheetConfig {
  return market === "KSA" ? KSA_CONFIG : EG_UAE_CONFIG;
}

export function configById(id: TimesheetConfigId | null): TimesheetConfig {
  return id ? CONFIGS[id] : EG_UAE_CONFIG;
}
