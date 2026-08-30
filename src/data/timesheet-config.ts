/**
 * Field-definition layer.
 *
 * Both configurations map to the same underlying TimesheetEntry record, so the
 * KSA layout can be changed later without touching Egypt / UAE. Add or remove
 * entries in `ksaConfig.fields` only — presentation components read this list.
 */

export type FieldKey =
  | "date"
  | "clientId"
  | "jobId"
  | "jobNumber"
  | "projectType"
  | "serviceId"
  | "task"
  | "hours"
  | "notes"
  | "billable"
  // KSA-only fields live here so they never leak into EG/UAE.
  | "costCenter"
  | "location";

export type FieldKind =
  | "date"
  | "client"
  | "job"
  | "derived"
  | "service"
  | "text"
  | "hours"
  | "billable"
  | "select";

export interface FieldDef {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  required: boolean;
  width: string;
  hint?: string;
  options?: { id: string; name: string }[];
}

export interface TimesheetFormConfig {
  id: "EG_UAE" | "KSA";
  label: string;
  expectedWeeklyHours: number;
  hoursStep: number;
  maxHoursPerDay: number;
  fields: FieldDef[];
}

const toOptions = (names: string[]) =>
  names.map((name) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name }));

export const projectTypeOptions = toOptions([
  "Monthly Social Calendar",
  "Amend",
  "Campaign",
  "Pop Up",
  "Greeting",
  "Master Visual",
  "Pitch",
]);

export const taskOptions = toOptions([
  "Key Visual",
  "Still Image",
  "GIF",
  "Video",
  "Copy",
  "Script",
  "Brainstorming",
  "Briefing",
  "Illustration",
  "Attending Shoot",
  "Crisis Management",
  "Moderation",
  "Flagging & Monitoring",
  "Reporting",
]);

export const serviceOptions = toOptions([
  "Art & Design",
  "Copywriting",
  "Community Management",
  "Consumer Insights",
  "Media Buying",
  "Motion",
  "Production",
  "Account Management",
]);

/**
 * What people actually fill in: Date, Client, Service, Project Type, Task,
 * an optional free-text Project note, and Hours.
 * The submitter's email is captured automatically from their Google sign-in.
 */
const sharedFields: FieldDef[] = [
  { key: "date", label: "Date", kind: "date", required: true, width: "w-[168px]" },
  { key: "clientId", label: "Client name", kind: "client", required: true, width: "min-w-[200px]" },
  {
    key: "serviceId",
    label: "Service",
    kind: "select",
    required: true,
    width: "min-w-[180px]",
    options: serviceOptions,
  },
  {
    key: "projectType",
    label: "Project Type",
    kind: "select",
    required: true,
    width: "min-w-[170px]",
    options: projectTypeOptions,
  },
  {
    key: "task",
    label: "Task / Description",
    kind: "select",
    required: true,
    width: "min-w-[170px]",
    options: taskOptions,
  },
  {
    key: "notes",
    label: "Project",
    kind: "text",
    required: false,
    width: "min-w-[180px]",
    hint: "Optional",
  },
  { key: "hours", label: "Hours", kind: "hours", required: true, width: "w-[110px]" },
];

export const egUaeConfig: TimesheetFormConfig = {
  id: "EG_UAE",
  label: "Egypt + UAE Timesheet",
  expectedWeeklyHours: 40,
  hoursStep: 0.25,
  maxHoursPerDay: 24,
  fields: sharedFields,
};

/** KSA-specific layer — safe to edit in isolation. */
export const ksaConfig: TimesheetFormConfig = {
  id: "KSA",
  label: "KSA Timesheet",
  expectedWeeklyHours: 40,
  hoursStep: 0.25,
  maxHoursPerDay: 24,
  fields: sharedFields,
};

export const configs: Record<"EG_UAE" | "KSA", TimesheetFormConfig> = {
  EG_UAE: egUaeConfig,
  KSA: ksaConfig,
};
