/**
 * Data access.
 *
 * Every call goes through a Postgres function that re-derives the caller's
 * identity from their JWT (`auth.uid()`) and re-checks their permissions, and
 * every table underneath is guarded by row-level security. The browser holds
 * only the user's own access token, so "trusting the client" is not possible
 * here: the database decides, not the caller.
 *
 * The one thing that genuinely cannot run here is the Google Sheets export,
 * because it needs a service-account key. That lives in a server function.
 */
import { requireSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { DayCoverage } from "@/lib/domain/coverage";
import type { PersonalStats } from "@/lib/domain/insights";
import type {
  AdminEmployeeStatus,
  ClientOption,
  Employee,
  Market,
  ReferenceData,
  ReferenceOption,
  SubmissionSummary,
  TimesheetEntry,
  WeekData,
} from "@/lib/domain/types";

/** A failure we can describe to the user without leaking internals. */
export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

const FRIENDLY_ERRORS: Record<string, string> = {
  not_authorized: "Your account is not authorized to access Kijamii Timesheets.",
  week_already_submitted: "This week has already been submitted and can no longer be edited.",
  future_week: "You cannot fill in a week that has not started yet.",
  week_must_start_sunday: "Weeks run Sunday to Saturday.",
  no_draft: "There is nothing saved for this week yet.",
  already_onboarded: "Your profile has already been set up.",
  invalid_primary_market: "Choose a main market from the markets you selected.",
  markets_required: "Select at least one market.",
  date_outside_week: "That date falls outside the selected week.",
};

function toApiError(error: { message?: string; code?: string } | null): ApiError {
  const raw = error?.message ?? "";
  for (const [code, message] of Object.entries(FRIENDLY_ERRORS)) {
    if (raw.includes(code)) return new ApiError(code, message);
  }
  // Anything unrecognised is reported generically; details stay in the logs.
  return new ApiError("unknown", "Something went wrong. Please try again.");
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`[timesheets] rpc ${fn} failed`, { code: error.code, message: error.message });
    throw toApiError(error);
  }
  return data as T;
}

// ------------------------------------------------------------------ profile

interface EmployeeRow {
  id: string;
  full_name: string;
  email: string;
  markets: Market[] | null;
  primary_market: Market | null;
  department: string | null;
  timesheet_configuration: "EG_UAE" | "KSA" | null;
  expected_weekly_hours: number | string;
  role: "employee" | "admin";
  active: boolean;
  onboarded_at: string | null;
}

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    markets: row.markets ?? [],
    primaryMarket: row.primary_market,
    department: row.department,
    configuration: row.timesheet_configuration,
    expectedWeeklyHours: Number(row.expected_weekly_hours),
    role: row.role,
    active: row.active,
    onboarded: row.onboarded_at !== null,
  };
}

/**
 * The signed-in employee, or null when the address has no roster record --
 * which is how an unauthorized account presents.
 */
export async function fetchCurrentEmployee(): Promise<Employee | null> {
  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("ts_employees")
    .select(
      "id, full_name, email, markets, primary_market, department, timesheet_configuration, expected_weekly_hours, role, active, onboarded_at",
    )
    .maybeSingle();

  if (error) {
    console.error("[timesheets] employee lookup failed", { code: error.code });
    throw toApiError(error);
  }
  if (!data) return null;
  return toEmployee(data as EmployeeRow);
}

export async function completeOnboarding(input: {
  markets: Market[];
  primaryMarket: Market;
  department: string | null;
  expectedWeeklyHours: number;
}): Promise<Employee> {
  const row = await rpc<EmployeeRow>("ts_complete_onboarding", {
    p_markets: input.markets,
    p_primary_market: input.primaryMarket,
    p_department: input.department,
    p_expected_hours: input.expectedWeeklyHours,
  });
  return toEmployee(row);
}

// ---------------------------------------------------------------- reference

export async function fetchReferenceData(): Promise<ReferenceData> {
  const supabase = requireSupabaseBrowserClient();

  const [clients, services, projectTypes, taskTypes, departments] = await Promise.all([
    supabase
      .from("ts_clients")
      .select("id, name, sector, markets, is_other")
      .eq("active", true)
      .order("is_other")
      .order("name"),
    supabase.from("ts_services").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("ts_project_types").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("ts_task_types").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("ts_departments").select("id, name").eq("active", true).order("sort_order"),
  ]);

  const failure = [clients, services, projectTypes, taskTypes, departments].find((r) => r.error);
  if (failure?.error) {
    console.error("[timesheets] reference load failed", { code: failure.error.code });
    throw toApiError(failure.error);
  }

  const asOptions = (rows: unknown): ReferenceOption[] =>
    ((rows ?? []) as { id: string; name: string }[]).map((r) => ({ id: r.id, name: r.name }));

  return {
    clients: (
      (clients.data ?? []) as {
        id: string;
        name: string;
        sector: string | null;
        markets: Market[] | null;
        is_other: boolean;
      }[]
    ).map<ClientOption>((r) => ({
      id: r.id,
      name: r.name,
      sector: r.sector,
      markets: r.markets ?? [],
      isOther: r.is_other,
    })),
    services: asOptions(services.data),
    projectTypes: asOptions(projectTypes.data),
    taskTypes: asOptions(taskTypes.data),
    departments: asOptions(departments.data),
  };
}

/**
 * Clients an employee may log against: those tied to one of their markets,
 * plus those with no market restriction at all.
 */
export function clientsForEmployee(clients: ClientOption[], markets: Market[]): ClientOption[] {
  if (markets.length === 0) return clients;
  return clients.filter(
    (client) => client.markets.length === 0 || client.markets.some((m) => markets.includes(m)),
  );
}

// -------------------------------------------------------------------- weeks

interface RawEntry {
  id: string;
  workDate: string;
  clientId: string | null;
  clientOther: string | null;
  serviceId: string | null;
  projectType: string | null;
  task: string | null;
  projectNote: string | null;
  hours: number | string | null;
  billable: boolean;
  status: TimesheetEntry["status"];
}

function toEntry(raw: RawEntry): TimesheetEntry {
  return {
    id: raw.id,
    workDate: raw.workDate,
    clientId: raw.clientId ?? "",
    clientOther: raw.clientOther ?? "",
    serviceId: raw.serviceId ?? "",
    projectType: raw.projectType ?? "",
    task: raw.task ?? "",
    projectNote: raw.projectNote ?? "",
    hours: raw.hours === null || raw.hours === "" ? "" : Number(raw.hours),
    billable: raw.billable,
    status: raw.status,
  };
}

export async function fetchWeek(weekStart: string): Promise<WeekData> {
  const data = await rpc<{
    weekStart: string;
    submission: WeekData["submission"];
    entries: RawEntry[];
    lockedDays: string[];
  }>("ts_get_week", { p_week_start: weekStart });

  return {
    weekStart: data.weekStart,
    submission: data.submission
      ? {
          ...data.submission,
          totalHours: Number(data.submission.totalHours),
          billableHours: Number(data.submission.billableHours),
          nonBillableHours: Number(data.submission.nonBillableHours),
          expectedHours: Number(data.submission.expectedHours),
          missingHours: Number(data.submission.missingHours),
        }
      : null,
    entries: (data.entries ?? []).map(toEntry),
    lockedDays: data.lockedDays ?? [],
  };
}

export interface SaveDraftResult {
  stale: boolean;
  revision: number;
  savedAt: string | null;
  submissionId: string | null;
}

/**
 * Persists the whole week. `revision` is a counter the caller increments per
 * save; the database rejects anything that is not newer than what it holds,
 * so a slow autosave cannot land on top of a newer one.
 */
export async function saveDraft(
  weekStart: string,
  entries: TimesheetEntry[],
  revision: number,
): Promise<SaveDraftResult> {
  const payload = entries.map((entry) => ({
    id: entry.id,
    work_date: entry.workDate,
    client_id: entry.clientId || null,
    client_other: entry.clientOther || null,
    service_id: entry.serviceId || null,
    project_type: entry.projectType || null,
    task: entry.task || null,
    project_note: entry.projectNote || null,
    hours: entry.hours === "" ? null : String(entry.hours),
    billable: entry.billable,
  }));

  const result = await rpc<{
    stale: boolean;
    revision: number;
    saved_at?: string;
    submission_id?: string;
  }>("ts_save_draft", {
    p_week_start: weekStart,
    p_entries: payload,
    p_revision: revision,
  });

  return {
    stale: result.stale,
    revision: Number(result.revision),
    savedAt: result.saved_at ?? null,
    submissionId: result.submission_id ?? null,
  };
}

export interface SubmitResult {
  ok: boolean;
  alreadySubmitted: boolean;
  submissionId?: string;
  submittedAt?: string;
  totalHours?: number;
  billableHours?: number;
  nonBillableHours?: number;
  missingHours?: number;
  problems?: { code: string; message: string; entryId?: string; fields?: string[] }[];
}

export async function submitWeek(weekStart: string): Promise<SubmitResult> {
  const result = await rpc<SubmitResult>("ts_submit_week", { p_week_start: weekStart });
  // Postgres returns numerics as strings; coerce only the keys that are present.
  return {
    ...result,
    ...(result.totalHours === undefined ? {} : { totalHours: Number(result.totalHours) }),
    ...(result.billableHours === undefined ? {} : { billableHours: Number(result.billableHours) }),
    ...(result.nonBillableHours === undefined
      ? {}
      : { nonBillableHours: Number(result.nonBillableHours) }),
    ...(result.missingHours === undefined ? {} : { missingHours: Number(result.missingHours) }),
  };
}

export async function submitDay(weekStart: string, workDate: string): Promise<SubmitResult> {
  return rpc<SubmitResult>("ts_submit_day", {
    p_week_start: weekStart,
    p_work_date: workDate,
  });
}

export async function fetchMySubmissions(): Promise<SubmissionSummary[]> {
  const rows = await rpc<SubmissionSummary[]>("ts_list_my_submissions");
  return (rows ?? []).map((row) => ({
    ...row,
    totalHours: Number(row.totalHours),
    billableHours: Number(row.billableHours),
    expectedHours: Number(row.expectedHours),
  }));
}

// -------------------------------------------------------------------- admin

export async function fetchAdminWeek(weekStart: string): Promise<AdminEmployeeStatus[]> {
  const data = await rpc<{ employees: AdminEmployeeStatus[] }>("ts_admin_week_overview", {
    p_week_start: weekStart,
  });
  return (data.employees ?? []).map((row) => ({
    ...row,
    markets: row.markets ?? [],
    totalHours: Number(row.totalHours),
    expectedHours: Number(row.expectedHours),
  }));
}

/** One exported row, flattened for a spreadsheet. */
export interface ExportRow {
  entryId: string;
  employeeName: string;
  employeeEmail: string;
  market: string;
  department: string | null;
  weekStart: string;
  workDate: string;
  clientName: string | null;
  serviceName: string | null;
  projectType: string | null;
  taskDescription: string | null;
  hours: number | string;
  notes: string | null;
  billable: boolean;
  status: string;
  submittedAt: string | null;
}

/**
 * Submitted entries between two dates, for the admin export. Drafts are
 * excluded: unfinished work has no business in a management report.
 */
export async function fetchExportRows(from: string, to: string): Promise<ExportRow[]> {
  const rows = await rpc<ExportRow[]>("ts_export_range", { p_from: from, p_to: to });
  return rows ?? [];
}

/**
 * One row of the "Egypt & UAE Time Dedication" feed: a person, a brand and a
 * month. Employees who logged nothing in the range still appear, with no
 * brand and zero hours, so the sheet keeps the whole roster.
 */
export interface TimeDedicationRow {
  /** `employee|brand|month`, for a spreadsheet lookup. Null on a roster row. */
  lookupKey: string | null;
  employeeCode: string | null;
  employeeName: string;
  department: string | null;
  market: string | null;
  clientCode: string | null;
  brandName: string | null;
  /** `YYYY-MM`. */
  month: string | null;
  hours: number | string;
}

/**
 * Hours by employee, brand and month for the agency job book. Admin-only and
 * EG/UAE only, both enforced in the database: KSA keeps no timesheets, so
 * there is no tab for it to feed.
 */
export async function fetchTimeDedicationRows(
  from: string,
  to: string,
): Promise<TimeDedicationRow[]> {
  const rows = await rpc<TimeDedicationRow[]>("ts_export_time_dedication", {
    p_from: from,
    p_to: to,
  });
  return rows ?? [];
}

/** The signed-in employee's own statistics. Scoped by the database to them. */
export async function fetchMyStats(from: string, to: string): Promise<PersonalStats> {
  const data = await rpc<PersonalStats>("ts_my_stats", { p_from: from, p_to: to });
  // Postgres returns numerics as strings; the insight maths needs real numbers.
  return {
    ...data,
    totalHours: Number(data.totalHours),
    billableHours: Number(data.billableHours),
    entryCount: Number(data.entryCount),
    daysLogged: Number(data.daysLogged),
    distinctClients: Number(data.distinctClients),
    distinctServices: Number(data.distinctServices),
    longestStreak: Number(data.longestStreak),
    previousTotal: Number(data.previousTotal),
    expectedWeeklyHours: Number(data.expectedWeeklyHours),
    busiestDay: data.busiestDay
      ? { ...data.busiestDay, hours: Number(data.busiestDay.hours) }
      : null,
    topClient: data.topClient ? { ...data.topClient, hours: Number(data.topClient.hours) } : null,
    topService: data.topService
      ? { ...data.topService, hours: Number(data.topService.hours) }
      : null,
    topTask: data.topTask ? { ...data.topTask, hours: Number(data.topTask.hours) } : null,
    clients: (data.clients ?? []).map((c) => ({ ...c, hours: Number(c.hours) })),
    byWeekday: (data.byWeekday ?? []).map((d) => ({ dow: Number(d.dow), hours: Number(d.hours) })),
  };
}

/** Hours per day for the signed-in employee, for the month coverage strip. */
export async function fetchMyLoggedDays(from: string, to: string): Promise<DayCoverage[]> {
  const rows = await rpc<DayCoverage[]>("ts_my_logged_days", { p_from: from, p_to: to });
  return (rows ?? []).map((row) => ({ date: row.date, hours: Number(row.hours) }));
}
