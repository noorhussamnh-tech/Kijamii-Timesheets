/** Shared domain types. These mirror the database enums exactly. */

export type Market = "EG" | "UAE" | "KSA";
export type TimesheetConfigId = "EG_UAE" | "KSA";
export type EmployeeRole = "employee" | "admin";
/** `returned` and `approved` exist in the schema but are not used in v1. */
export type SubmissionStatus = "draft" | "submitted" | "returned" | "approved";
/** What the admin overview shows for someone with no record for a week. */
export type WeekStatus = SubmissionStatus | "missing";

export const MARKETS: readonly Market[] = ["EG", "UAE", "KSA"];

export const MARKET_LABELS: Record<Market, string> = {
  EG: "Egypt",
  UAE: "UAE",
  KSA: "Saudi Arabia",
};

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  markets: Market[];
  primaryMarket: Market | null;
  department: string | null;
  configuration: TimesheetConfigId | null;
  expectedWeeklyHours: number;
  role: EmployeeRole;
  active: boolean;
  onboarded: boolean;
}

export interface ReferenceOption {
  id: string;
  name: string;
}

export interface ClientOption extends ReferenceOption {
  /** Empty means the client is available in every market. */
  markets: Market[];
  sector: string | null;
  /** The single free-text client; selecting it reveals a name input. */
  isOther: boolean;
}

export interface ReferenceData {
  clients: ClientOption[];
  services: ReferenceOption[];
  projectTypes: ReferenceOption[];
  taskTypes: ReferenceOption[];
  departments: ReferenceOption[];
}

/** A single row of the timesheet grid. */
/** Whether an hour fell inside what the client contracted for. */
export type EntryScope = "in_scope" | "out_of_scope";

export const SCOPE_LABELS: Record<EntryScope, string> = {
  in_scope: "In Scope",
  out_of_scope: "Out of Scope",
};

export interface TimesheetEntry {
  id: string;
  workDate: string;
  clientId: string;
  clientOther: string;
  serviceId: string;
  projectType: string;
  task: string;
  scope: EntryScope;
  projectNote: string;
  /** Empty string while the field is blank; drafts may hold incomplete rows. */
  hours: number | "";
  billable: boolean;
  status: SubmissionStatus;
}

export interface WeekSubmission {
  id: string;
  status: SubmissionStatus;
  revision: number;
  submittedAt: string | null;
  updatedAt: string | null;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  expectedHours: number;
  missingHours: number;
}

export interface WeekData {
  weekStart: string;
  submission: WeekSubmission | null;
  entries: TimesheetEntry[];
  lockedDays: string[];
}

export interface SubmissionSummary {
  weekStart: string;
  weekEnd: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  totalHours: number;
  billableHours: number;
  expectedHours: number;
}

export interface AdminEmployeeStatus {
  employeeId: string;
  name: string;
  email: string;
  markets: Market[];
  primaryMarket: Market | null;
  department: string | null;
  expectedHours: number;
  status: WeekStatus;
  totalHours: number;
  submittedAt: string | null;
}
