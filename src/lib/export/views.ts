/**
 * The ways a set of logged hours can be read.
 *
 * One list, shared by the toolbar's "Export by" menu and by the per-person
 * panel beside it, so the two cannot offer different groupings of the same
 * data. Every one folds the same fetched rows rather than running its own
 * query, which is what makes a monthly total and the daily totals underneath
 * it agree.
 */
import type { EmployeeDetailExport } from "@/lib/data/api";
import {
  fullDetailView,
  perBusinessUnitView,
  perClientByDayView,
  perClientView,
  perDayView,
  perFunctionView,
  perMonthView,
  perPositionView,
  perProjectTypeView,
  perSubUnitView,
  perWeekView,
  summaryView,
} from "@/lib/export/employee-detail";
import type { Shaped } from "@/lib/export/time-dedication";

export interface ExportView {
  id: string;
  /** How the menu names it. */
  label: string;
  /** One line under the label, for the panel that has room for one. */
  note: string;
  shape: (data: EmployeeDetailExport) => Shaped;
}

/** Every entry, and the two summaries that describe people rather than work. */
export const DETAIL_VIEWS: ExportView[] = [
  {
    id: "full-detail",
    label: "Every entry",
    note: "One row per logged entry. Every view below pivots out of this one.",
    shape: (data) => fullDetailView(data.rows),
  },
  {
    id: "summary",
    label: "Summary per person",
    note: "Total hours, days logged, clients touched.",
    shape: (data) => summaryView(data.rows, data.employees),
  },
];

/** Time, by the calendar. */
export const PERIOD_VIEWS: ExportView[] = [
  {
    id: "per-day",
    label: "By day",
    note: "One line per person per day.",
    shape: (data) => perDayView(data.rows),
  },
  {
    id: "per-week",
    label: "By week",
    note: "Weeks run Sunday to Saturday, as the timesheet does.",
    shape: (data) => perWeekView(data.rows),
  },
  {
    id: "per-month",
    label: "By month",
    note: "One line per person per calendar month.",
    shape: (data) => perMonthView(data.rows),
  },
];

/** What the work was. */
export const WORK_VIEWS: ExportView[] = [
  {
    id: "per-client",
    label: "By client",
    note: "With each client's share of their time.",
    shape: (data) => perClientView(data.rows),
  },
  {
    id: "client-by-day",
    label: "By client, day by day",
    note: "A grid: clients down, days across.",
    shape: (data) => perClientByDayView(data.rows),
  },
  {
    id: "per-project-type",
    label: "By project type",
    note: "Campaign, Reels, Pitch, and the rest.",
    shape: (data) => perProjectTypeView(data.rows),
  },
];

/** Who did it, as the company employee list describes them. */
export const PEOPLE_VIEWS: ExportView[] = [
  {
    id: "per-business-unit",
    label: "By business unit",
    note: "From the company employee list.",
    shape: (data) => perBusinessUnitView(data.rows),
  },
  {
    id: "per-sub-unit",
    label: "By sub-unit",
    note: "The team inside a business unit.",
    shape: (data) => perSubUnitView(data.rows),
  },
  {
    id: "per-function",
    label: "By function",
    note: "The craft: Art, Copywriting, Account Management.",
    shape: (data) => perFunctionView(data.rows),
  },
  {
    id: "per-title",
    label: "By title",
    note: "Job titles, as the employee list has them.",
    shape: (data) => perPositionView(data.rows),
  },
];

/** The menu, in groups, in the order they are offered. */
export const VIEW_GROUPS: { label: string; views: ExportView[] }[] = [
  { label: "Everything", views: DETAIL_VIEWS },
  { label: "By period", views: PERIOD_VIEWS },
  { label: "By work", views: WORK_VIEWS },
  { label: "By person", views: PEOPLE_VIEWS },
];

export const ALL_VIEWS: ExportView[] = VIEW_GROUPS.flatMap((group) => group.views);

export const viewById = (id: string): ExportView =>
  ALL_VIEWS.find((v) => v.id === id) ?? ALL_VIEWS[0]!;
