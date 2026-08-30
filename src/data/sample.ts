import { format } from "date-fns";
import type { MarketId } from "./reference";
import type { SubmissionStatus, TimesheetEntry, WeekSubmission } from "./weeks";
import { shiftWeekKey, weekDays, weekKeyOf } from "./weeks";

let seq = 0;
const id = () => `seed-${++seq}`;
const d = (weekKey: string, offset: number) => format(weekDays(weekKey)[offset]!, "yyyy-MM-dd");

type Seed = Omit<TimesheetEntry, "id" | "date"> & { day: number };

const buildWeek = (weekKey: string, seeds: Seed[]): TimesheetEntry[] =>
  seeds.map(({ day, ...rest }) => ({ ...rest, id: id(), date: d(weekKey, day) }));

const row = (
  day: number,
  clientId: string,
  serviceId: string,
  projectType: string,
  task: string,
  hours: number | "",
  notes = "",
): Seed => ({
  day,
  verticalId: "EG",
  clientId,
  clientOther: "",
  jobId: "",
  jobNumber: "",
  serviceId,
  projectType,
  task,
  hours,
  billable: true,
  notes,
});

export const thisWeekKey = weekKeyOf(new Date());
export const lastWeekKey = shiftWeekKey(thisWeekKey, -1);
export const twoWeeksAgoKey = shiftWeekKey(thisWeekKey, -2);
export const threeWeeksAgoKey = shiftWeekKey(thisWeekKey, -3);

/** Current week: partially completed draft, including one incomplete row. */
const currentWeekSeeds: Seed[] = [
  row(0, "c-eg-myf", "community-management", "monthly-social-calendar", "copy", 3, "Always-on calendar"),
  row(0, "c-eg-castrol", "account-management", "amend", "briefing", 1),
  // Intentionally incomplete row so validation states can be reviewed.
  {
    day: 0,
    verticalId: "EG",
    clientId: "c-eg-castrol",
    clientOther: "",
    jobId: "",
    jobNumber: "",
    serviceId: "",
    projectType: "",
    task: "",
    hours: "",
    billable: true,
    notes: "",
  },
];

const submittedWeekSeeds: Seed[] = [
  row(0, "c-eg-myf", "community-management", "monthly-social-calendar", "copy", 4),
  row(0, "c-eg-castrol", "account-management", "amend", "briefing", 2),
  row(1, "c-eg-kfh", "consumer-insights", "campaign", "still-image", 6),
  row(1, "c-eg-btc", "consumer-insights", "master-visual", "brainstorming", 2),
  row(2, "c-eg-myf", "copywriting", "monthly-social-calendar", "copy", 5),
  row(2, "c-eg-allianz", "media-buying", "campaign", "gif", 3),
  row(3, "c-eg-kfh", "art-design", "campaign", "video", 7),
  row(3, "c-eg-castrol", "account-management", "pop-up", "briefing", 1),
  row(4, "c-eg-btc", "art-design", "greeting", "illustration", 5),
  row(4, "c-eg-myf", "production", "campaign", "video", 3),
];


const olderWeekSeeds: Seed[] = submittedWeekSeeds.slice(0, 8);
const oldestWeekSeeds: Seed[] = submittedWeekSeeds.slice(0, 6);

export const seedEntries = (): Record<string, TimesheetEntry[]> => ({
  [thisWeekKey]: buildWeek(thisWeekKey, currentWeekSeeds),
  [lastWeekKey]: buildWeek(lastWeekKey, submittedWeekSeeds),
  [twoWeeksAgoKey]: buildWeek(twoWeeksAgoKey, olderWeekSeeds),
  [threeWeeksAgoKey]: buildWeek(threeWeeksAgoKey, oldestWeekSeeds),
});

export const seedSubmissions = (): Record<string, WeekSubmission> => ({
  [thisWeekKey]: {
    weekKey: thisWeekKey,
    status: "draft",
    lastSavedAt: `${thisWeekKey}T09:41:00`,
  },
  [lastWeekKey]: {
    weekKey: lastWeekKey,
    status: "submitted",
    submittedAt: `${lastWeekKey}T17:20:00`,
  },
  [twoWeeksAgoKey]: {
    weekKey: twoWeeksAgoKey,
    status: "submitted",
    submittedAt: `${twoWeeksAgoKey}T16:05:00`,
  },
  [threeWeeksAgoKey]: {
    weekKey: threeWeeksAgoKey,
    status: "submitted",
    submittedAt: `${threeWeeksAgoKey}T18:12:00`,
  },
});

export interface RosterRow {
  id: string;
  name: string;
  initials: string;
  marketId: MarketId;
  departmentId: string;
  status: SubmissionStatus;
  hours: number;
  submittedAt?: string;
}

export const adminRoster: RosterRow[] = [
  { id: "r1", name: "Noor Hussam", initials: "NH", marketId: "EG", departmentId: "accounts", status: "draft", hours: 14.25 },
  { id: "r2", name: "Dina Fawzy", initials: "DF", marketId: "EG", departmentId: "accounts", status: "submitted", hours: 41, submittedAt: "Fri 09:12" },
  { id: "r3", name: "Karim Salah", initials: "KS", marketId: "EG", departmentId: "creative", status: "submitted", hours: 40, submittedAt: "Thu 18:40" },
  { id: "r4", name: "Mariam Adel", initials: "MA", marketId: "EG", departmentId: "creative", status: "missing", hours: 0 },
  { id: "r5", name: "Youssef Hany", initials: "YH", marketId: "EG", departmentId: "media", status: "submitted", hours: 39.5, submittedAt: "Thu 16:05" },
  { id: "r6", name: "Salma Ibrahim", initials: "SI", marketId: "EG", departmentId: "strategy", status: "submitted", hours: 42.25, submittedAt: "Fri 08:31" },
  { id: "r7", name: "Omar Fathy", initials: "OF", marketId: "EG", departmentId: "production", status: "draft", hours: 22 },
  { id: "r8", name: "Layla Mansour", initials: "LM", marketId: "UAE", departmentId: "accounts", status: "submitted", hours: 40, submittedAt: "Fri 10:02" },
  { id: "r9", name: "Rashid Al Marzouqi", initials: "RA", marketId: "UAE", departmentId: "media", status: "missing", hours: 0 },
  { id: "r10", name: "Hana Zayed", initials: "HZ", marketId: "UAE", departmentId: "creative", status: "submitted", hours: 38.75, submittedAt: "Fri 11:20" },
  { id: "r11", name: "Faisal Al Otaibi", initials: "FA", marketId: "KSA", departmentId: "accounts", status: "submitted", hours: 40, submittedAt: "Thu 15:44" },
  { id: "r12", name: "Reem Al Harbi", initials: "RH", marketId: "KSA", departmentId: "strategy", status: "draft", hours: 18.5 },
  { id: "r13", name: "Turki Nasser", initials: "TN", marketId: "KSA", departmentId: "media", status: "submitted", hours: 41.5, submittedAt: "Fri 09:58" },
  { id: "r14", name: "Amal Saeed", initials: "AS", marketId: "KSA", departmentId: "creative", status: "missing", hours: 0 },
  { id: "r15", name: "Ziad Kamel", initials: "ZK", marketId: "EG", departmentId: "tech", status: "submitted", hours: 40, submittedAt: "Fri 12:15" },
  { id: "r16", name: "Nada Sherif", initials: "NS", marketId: "EG", departmentId: "ops", status: "submitted", hours: 40, submittedAt: "Thu 17:02" },
];
