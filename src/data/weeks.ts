import { addDays, format, startOfWeek } from "date-fns";
import type { MarketId } from "./reference";

/** Week keys are the Sunday-start ISO date, e.g. "2026-08-30". */
export const weekStart = (d: Date) => startOfWeek(d, { weekStartsOn: 0 });
export const weekKeyOf = (d: Date) => format(weekStart(d), "yyyy-MM-dd");

/** Entries can be logged up to and including this date. */
export const MAX_ENTRY_DATE = "2027-08-31";
export const MIN_ENTRY_DATE = "2024-01-01";

export const weekDays = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const base = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return Array.from({ length: 7 }, (_, i) => addDays(base, i));
};

export const weekRangeLabel = (key: string) => {
  const days = weekDays(key);
  const a = days[0]!;
  const b = days[6]!;
  const sameMonth = a.getMonth() === b.getMonth();
  return `${format(a, "d MMM")} – ${format(b, sameMonth ? "d MMM yyyy" : "d MMM yyyy")}`;
};

export const weekNumberLabel = (key: string) => `Week ${format(weekDays(key)[0]!, "w, yyyy")}`;

export const shiftWeekKey = (key: string, weeks: number) =>
  weekKeyOf(addDays(weekDays(key)[0]!, weeks * 7));

export const isFutureWeek = (key: string, today = new Date()) =>
  weekDays(key)[0]!.getTime() > weekStart(today).getTime();

export type SubmissionStatus = "draft" | "submitted" | "missing";

export interface TimesheetEntry {
  id: string;
  date: string; // yyyy-MM-dd
  /** Vertical the entry was registered under — stored with the record. */
  verticalId: MarketId;
  clientId: string;
  /** Free-text client name, used when clientId is the "Other" option. */
  clientOther: string;
  jobId: string;
  jobNumber: string;
  projectType: string;
  serviceId: string;
  task: string;
  hours: number | "";
  notes: string;
  billable: boolean;
  /** KSA-only values, ignored by the EG/UAE configuration. */
  costCenter?: string;
  location?: string;
}

export interface WeekSubmission {
  weekKey: string;
  status: SubmissionStatus;
  submittedAt?: string | undefined;
  lastSavedAt?: string | undefined;
  note?: string | undefined;
}

let rowSeq = 0;
export const newRowId = () => `row-${++rowSeq}`;

export const emptyEntry = (date: string, marketId: MarketId): TimesheetEntry => ({
  id: newRowId(),
  date,
  verticalId: marketId,
  clientId: "",
  clientOther: "",
  jobId: "",
  jobNumber: "",
  projectType: "",
  serviceId: "",
  task: "",
  hours: "",
  notes: "",
  billable: true,
  ...(marketId === "KSA" ? { costCenter: "", location: "" } : {}),
});
