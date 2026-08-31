/**
 * The line at the top of the timesheet.
 *
 * It reads the person's own month and changes with it, which is the whole
 * point: a fixed slogan becomes wallpaper by the third day, and a line that
 * knows whether you are up to date is worth glancing at.
 *
 * One rule governs every string here: **it never scolds.** Somebody eleven
 * days behind already knows. Telling them off is how a tool becomes the thing
 * people avoid opening, and avoidance is the only real failure mode this app
 * has. Behind-schedule copy is short, blameless, and points at the next
 * action rather than the backlog.
 */
import type { MonthCoverage } from "@/lib/domain/coverage";

export type NoteTone = "praise" | "steady" | "invite";

export interface DailyNote {
  emoji: string;
  text: string;
  tone: NoteTone;
}

/**
 * Lines for somebody who is keeping up. These are the jokes -- they are only
 * ever shown to people who have earned them, because a gag about how nobody
 * enjoys timesheets lands very differently on somebody who is behind.
 *
 * Chosen by day so it is stable for a whole day and different tomorrow.
 */
const KEEPING_UP = [
  {
    emoji: "🎯",
    text: "No timesheet has ever been filled in enthusiastically. You are doing great.",
  },
  { emoji: "📊", text: "Somewhere, a spreadsheet is grateful." },
  { emoji: "⭐", text: "Filling this in on time is a personality trait. A good one." },
  { emoji: "🔍", text: "Every hour you log is an hour that stops being a mystery in March." },
  {
    emoji: "🧠",
    text: "Your future self, trying to remember what happened in August, says thanks.",
  },
  {
    emoji: "⏱️",
    text: "This took ninety seconds. The meeting about it would have taken forty minutes.",
  },
  { emoji: "🧾", text: "Time tracked is time you can argue about with evidence." },
  {
    emoji: "🎪",
    text: "Nobody has ever regretted logging their hours. Plenty have regretted not.",
  },
];

function pickByDay<T>(options: readonly T[], today: Date): T {
  const dayNumber = Math.floor(today.getTime() / 86_400_000);
  return options[Math.abs(dayNumber) % options.length]!;
}

/**
 * @param coverage This month's working days, logged and missing.
 * @param today    Injected so the choice is testable rather than clock-dependent.
 */
export function dailyNote(coverage: MonthCoverage, today: Date = new Date()): DailyNote {
  const { missing, logged, workingDaysSoFar, completion } = coverage;

  // A month that has not really started yet. Nothing to praise, nothing to
  // chase -- just an opening.
  if (workingDaysSoFar === 0) {
    return {
      emoji: "🌱",
      text: "A fresh month. Nothing to catch up on yet.",
      tone: "invite",
    };
  }

  if (logged.length === 0) {
    return {
      emoji: "🌱",
      text: "Nothing logged this month yet. Today is the easiest day to start with.",
      tone: "invite",
    };
  }

  if (missing.length === 0) {
    return {
      emoji: "🏆",
      text: `Every working day this month is accounted for. All ${workingDaysSoFar} of them.`,
      tone: "praise",
    };
  }

  if (completion >= 0.8) {
    const line = pickByDay(KEEPING_UP, today);
    return { emoji: line.emoji, text: line.text, tone: "praise" };
  }

  if (completion >= 0.5) {
    return {
      emoji: "👋",
      text: `${missing.length} day${missing.length === 1 ? "" : "s"} still open this month. They fill in faster than you would think.`,
      tone: "steady",
    };
  }

  // Behind. Name one day, not the pile: a single next step is actionable
  // where a backlog is only discouraging.
  return {
    emoji: "☕",
    text: "Some days are still empty. Start with the most recent one — the rest gets easier after that.",
    tone: "invite",
  };
}
