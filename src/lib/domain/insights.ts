/**
 * Personal insights: the numbers a person's own timesheet can tell them.
 *
 * The point of logging daily is self-awareness, so this turns the raw rows
 * into things worth reading. Everything here is derived arithmetic on data the
 * person entered themselves -- no scoring, no ranking against colleagues, and
 * nothing that would make sense as a performance measure. It is a mirror, not
 * a report card.
 */

export interface PersonalStats {
  from: string;
  to: string;
  totalHours: number;
  billableHours: number;
  entryCount: number;
  daysLogged: number;
  distinctClients: number;
  distinctServices: number;
  longestStreak: number;
  busiestDay: { date: string; hours: number } | null;
  topClient: { name: string | null; hours: number } | null;
  topService: { name: string | null; hours: number } | null;
  topTask: { name: string | null; hours: number } | null;
  clients: { name: string | null; hours: number }[];
  byWeekday: { dow: number; hours: number }[];
  previousTotal: number;
  expectedWeeklyHours: number;
}

export interface WorkPersonality {
  id: string;
  title: string;
  blurb: string;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Share of hours that went to the single biggest client, 0 to 1. */
export function topClientShare(stats: PersonalStats): number {
  if (stats.totalHours <= 0 || !stats.topClient) return 0;
  return stats.topClient.hours / stats.totalHours;
}

export function averageHoursPerEntry(stats: PersonalStats): number {
  if (stats.entryCount === 0) return 0;
  return round(stats.totalHours / stats.entryCount);
}

export function averageHoursPerLoggedDay(stats: PersonalStats): number {
  if (stats.daysLogged === 0) return 0;
  return round(stats.totalHours / stats.daysLogged);
}

export function billableShare(stats: PersonalStats): number {
  if (stats.totalHours <= 0) return 0;
  return stats.billableHours / stats.totalHours;
}

/** Change against the previous window of equal length, as a fraction. */
export function changeVsPrevious(stats: PersonalStats): number | null {
  if (stats.previousTotal <= 0) return null;
  return (stats.totalHours - stats.previousTotal) / stats.previousTotal;
}

/** 0 = Sunday. Returns null when nothing has been logged. */
export function busiestWeekday(stats: PersonalStats): number | null {
  if (stats.byWeekday.length === 0) return null;
  return stats.byWeekday.reduce((best, day) => (day.hours > best.hours ? day : best)).dow;
}

/**
 * A light-hearted label for how someone's time is shaped.
 *
 * Ordered most-specific first so the result is deterministic, and every branch
 * describes a *pattern* rather than a judgement -- "deep" is not better than
 * "varied", they are just different weeks.
 */
export function workPersonality(stats: PersonalStats): WorkPersonality {
  if (stats.entryCount === 0) {
    return {
      id: "unwritten",
      title: "The Unwritten",
      blurb: "Nothing logged yet. Your story starts with the first row.",
    };
  }

  const share = topClientShare(stats);
  const perEntry = averageHoursPerEntry(stats);
  const clientsPerDay = stats.daysLogged > 0 ? stats.distinctClients / stats.daysLogged : 0;

  if (share >= 0.7 && stats.topClient?.name) {
    return {
      id: "devoted",
      title: "The Devoted",
      blurb: `${Math.round(share * 100)}% of your time went to ${stats.topClient.name}. You go deep, not wide.`,
    };
  }

  if (stats.distinctClients >= 6) {
    return {
      id: "juggler",
      title: "The Juggler",
      blurb: `${stats.distinctClients} different clients. Switching costs are real — hopefully you got a coffee out of it.`,
    };
  }

  if (perEntry >= 4) {
    return {
      id: "deep-worker",
      title: "The Deep Worker",
      blurb: `Your average session ran ${perEntry} hours. Long, uninterrupted blocks.`,
    };
  }

  if (perEntry > 0 && perEntry <= 1.5) {
    return {
      id: "sprinter",
      title: "The Sprinter",
      blurb: `${stats.entryCount} entries averaging ${perEntry}h each. Lots of small, fast pieces.`,
    };
  }

  if (stats.longestStreak >= 10) {
    return {
      id: "metronome",
      title: "The Metronome",
      blurb: `${stats.longestStreak} days logged in a row. Relentlessly consistent.`,
    };
  }

  if (stats.distinctServices >= 5) {
    return {
      id: "polymath",
      title: "The Polymath",
      blurb: `${stats.distinctServices} different services. You do a bit of everything.`,
    };
  }

  if (clientsPerDay > 0 && clientsPerDay < 1) {
    return {
      id: "focused",
      title: "The Focused",
      blurb: "Roughly one thing at a time. Rare, and underrated.",
    };
  }

  return {
    id: "steady",
    title: "The Steady Hand",
    blurb: `${round(stats.totalHours)} hours across ${stats.daysLogged} days. Reliable, no drama.`,
  };
}

export interface Trivia {
  id: string;
  headline: string;
  detail: string;
}

/**
 * The handful of facts worth surfacing, strongest first. Anything that cannot
 * be computed from what the person logged is simply left out rather than
 * padded with a placeholder.
 */
export function buildTrivia(stats: PersonalStats): Trivia[] {
  const out: Trivia[] = [];
  if (stats.entryCount === 0) return out;

  if (stats.topClient?.name) {
    out.push({
      id: "top-client",
      headline: stats.topClient.name,
      detail: `Your most-logged client — ${round(stats.topClient.hours)}h, ${Math.round(
        topClientShare(stats) * 100,
      )}% of your time.`,
    });
  }

  if (stats.topService?.name) {
    out.push({
      id: "top-service",
      headline: stats.topService.name,
      detail: `Where most of your hours went — ${round(stats.topService.hours)}h.`,
    });
  }

  if (stats.busiestDay) {
    out.push({
      id: "busiest-day",
      headline: `${round(stats.busiestDay.hours)}h in one day`,
      detail: "Your longest logged day of the period.",
    });
  }

  if (stats.longestStreak >= 3) {
    out.push({
      id: "streak",
      headline: `${stats.longestStreak}-day streak`,
      detail: "Consecutive days you logged something. Habits are built like this.",
    });
  }

  const change = changeVsPrevious(stats);
  if (change !== null && Math.abs(change) >= 0.1) {
    const pct = Math.round(Math.abs(change) * 100);
    out.push({
      id: "trend",
      headline: `${pct}% ${change > 0 ? "more" : "less"} than last time`,
      detail: `You logged ${round(stats.totalHours)}h against ${round(stats.previousTotal)}h in the period before.`,
    });
  }

  if (stats.topTask?.name) {
    out.push({
      id: "top-task",
      headline: stats.topTask.name,
      detail: `Your most frequent kind of work — ${round(stats.topTask.hours)}h.`,
    });
  }

  return out;
}
