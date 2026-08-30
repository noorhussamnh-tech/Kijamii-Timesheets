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
  | "workDate"
  | "clientId"
  | "serviceId"
  | "projectType"
  | "task"
  | "projectNote"
  | "hours"
  | "billable";

export type FieldKind = "date" | "client" | "reference" | "text" | "hours" | "billable";

export interface FieldDef {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  required: boolean;
  /** Which reference list feeds a `reference` field. */
  source?: "services" | "projectTypes" | "taskTypes";
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
 * What people actually fill in: Date, Client, Service, Project Type, Task and
 * Hours, with an optional free-text Project note. There is deliberately no Job
 * field -- Kijamii has no job-numbering system.
 */
const sharedFields: FieldDef[] = [
  { key: "workDate", label: "Date", kind: "date", required: true, width: "w-[150px]" },
  { key: "clientId", label: "Client name", kind: "client", required: true, width: "min-w-[190px]" },
  {
    key: "serviceId",
    label: "Service",
    kind: "reference",
    source: "services",
    required: true,
    width: "min-w-[180px]",
  },
  {
    key: "projectType",
    label: "Project Type",
    kind: "reference",
    source: "projectTypes",
    required: true,
    width: "min-w-[170px]",
  },
  {
    key: "task",
    label: "Task / Description",
    kind: "reference",
    source: "taskTypes",
    required: true,
    width: "min-w-[170px]",
    wide: true,
  },
  {
    key: "projectNote",
    label: "Project",
    kind: "text",
    required: false,
    width: "min-w-[170px]",
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
