/**
 * The shape of the exported Google Sheet.
 *
 * Column order here is the contract with whoever reads the spreadsheet, so it
 * is defined once and used for both the header row and every data row. Adding
 * a column means adding it in one place.
 */
import type { Market } from "@/lib/domain/types";

export const TIMESHEET_ENTRIES_TAB = "Timesheet_Entries";
export const WEEKLY_SUBMISSIONS_TAB = "Weekly_Submissions";

export const TIMESHEET_ENTRIES_HEADERS = [
  "entry_id",
  "submission_id",
  "employee_id",
  "employee_name",
  "employee_email",
  "market",
  "department",
  "week_start",
  "week_end",
  "work_date",
  "client_id",
  "client_name",
  "service_id",
  "service_name",
  "project_type",
  "task_description",
  "hours",
  "notes",
  "billing_type",
  "timesheet_configuration",
  "status",
  "created_at",
  "updated_at",
  "submitted_at",
] as const;

export const WEEKLY_SUBMISSIONS_HEADERS = [
  "submission_id",
  "employee_id",
  "employee_name",
  "employee_email",
  "market",
  "department",
  "week_start",
  "week_end",
  "total_hours",
  "billable_hours",
  "non_billable_hours",
  "expected_hours",
  "missing_hours",
  "status",
  "submitted_at",
  "updated_at",
] as const;

export interface ExportEntryRow {
  entryId: string;
  submissionId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  market: Market;
  department: string | null;
  weekStart: string;
  weekEnd: string;
  workDate: string;
  clientId: string | null;
  clientName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  projectType: string | null;
  taskDescription: string | null;
  hours: number;
  notes: string | null;
  billable: boolean;
  configuration: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

/** Values in the exact order of TIMESHEET_ENTRIES_HEADERS. */
export function entryToRow(entry: ExportEntryRow): unknown[] {
  return [
    entry.entryId,
    entry.submissionId,
    entry.employeeId,
    entry.employeeName,
    entry.employeeEmail,
    entry.market,
    entry.department,
    entry.weekStart,
    entry.weekEnd,
    entry.workDate,
    entry.clientId,
    entry.clientName,
    entry.serviceId,
    entry.serviceName,
    entry.projectType,
    entry.taskDescription,
    entry.hours,
    entry.notes,
    // Spelled out rather than TRUE/FALSE so the column reads on its own.
    entry.billable ? "Billable" : "Non-billable",
    entry.configuration,
    entry.status,
    entry.createdAt,
    entry.updatedAt,
    entry.submittedAt,
  ];
}
