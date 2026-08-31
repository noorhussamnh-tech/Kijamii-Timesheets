/**
 * Moments worth a bit of confetti.
 *
 * Two rules keep this from becoming noise. A milestone fires once and is
 * remembered, so nobody gets the same celebration twice for the same thing.
 * And every milestone is about a *habit* -- logging at all, logging
 * consistently -- rather than about output, because a timesheet that cheers
 * volume is a timesheet that quietly asks for more of it.
 *
 * The one exception is `beat-previous`, which was asked for by name. It is
 * kept separate below so it is easy to find and easy to remove.
 */
import type { PersonalStats } from "@/lib/domain/insights";

export interface Milestone {
  id: string;
  title: string;
  line: string;
}

/**
 * The milestone to celebrate now, or null.
 *
 * `seen` is the set of milestone ids already celebrated for this person. Only
 * one fires at a time: two bursts at once is a mess, and the runner-up will
 * still be waiting on the next visit.
 */
export function milestoneFor(
  stats: PersonalStats,
  seen: ReadonlySet<string>,
  workDaysPerWeek = 5,
): Milestone | null {
  const candidates: Milestone[] = [];

  // The first three, not just the first. A habit is not formed by one entry,
  // and the days right after starting are exactly where people quietly stop.
  const OPENING = [
    {
      id: "first-entry",
      title: "That's one.",
      line: "Your first logged hours. The hard part was starting.",
    },
    {
      id: "second-entry",
      title: "Twice is a pattern.",
      line: "Two entries in. This is roughly where most people give up — you did not.",
    },
    {
      id: "third-entry",
      title: "Three. It's a habit now.",
      line: "Three entries logged. From here it stops being a thing you have to remember.",
    },
  ];
  for (let i = 0; i < OPENING.length; i += 1) {
    if (stats.entryCount > i) candidates.push(OPENING[i]!);
  }

  // Consistency, which is the actual goal: a week where nothing was skipped.
  if (stats.daysLogged >= workDaysPerWeek) {
    candidates.push({
      id: "full-week",
      title: "A full week, logged.",
      line: `${stats.daysLogged} days accounted for. Nothing reconstructed from memory.`,
    });
  }

  if (stats.longestStreak >= 5) {
    candidates.push({
      id: "streak-5",
      title: "Five in a row.",
      line: "Five consecutive days logged. That is a habit forming, not luck.",
    });
  }

  if (stats.longestStreak >= 20) {
    candidates.push({
      id: "streak-20",
      title: "Twenty days running.",
      line: "Most people never get here. You did it without being chased.",
    });
  }

  // Asked for by name. Note that it rewards a bigger number, which is the one
  // thing this page otherwise avoids -- delete this block to drop it.
  if (stats.previousTotal > 0 && stats.totalHours > stats.previousTotal) {
    candidates.push({
      id: "beat-previous",
      title: "Busier than last time.",
      line: "More logged than the period before. Worth noticing either way.",
    });
  }

  // Rarest first, but the opening three come before anything else: somebody
  // taking their first steps should hear about those, not about a streak.
  const rank = [
    "first-entry",
    "second-entry",
    "third-entry",
    "streak-20",
    "streak-5",
    "full-week",
    "beat-previous",
  ];
  const unseen = candidates
    .filter((milestone) => !seen.has(milestone.id))
    .sort((a, b) => rank.indexOf(a.id) - rank.indexOf(b.id));

  return unseen[0] ?? null;
}

/**
 * Lines about timesheets that do not take themselves seriously.
 *
 * Text rather than an image on purpose: a joke that stops being funny can be
 * rewritten in a pull request, where a meme has to be redrawn, and copy
 * inherits the page's typography in both themes for free.
 *
 * Chosen by day so a person sees the same one all day and a different one
 * tomorrow -- rotating on every render reads as a page that cannot sit still.
 */
const WRY_LINES = [
  "No timesheet has ever been filled in enthusiastically. You are doing great.",
  "Somewhere, a spreadsheet is grateful.",
  "Filling this in on time is a personality trait. A good one.",
  "Every hour you log is an hour that stops being a mystery in March.",
  "Nobody has ever regretted logging their hours. Plenty have regretted not.",
  "This took ninety seconds. The meeting about it would have taken forty minutes.",
  "Your future self, trying to remember what happened in August, says thanks.",
  "Time tracked is time you can argue about with evidence.",
];

export function wryLine(today: Date = new Date()): string {
  const dayNumber = Math.floor(today.getTime() / 86_400_000);
  return WRY_LINES[Math.abs(dayNumber) % WRY_LINES.length]!;
}
