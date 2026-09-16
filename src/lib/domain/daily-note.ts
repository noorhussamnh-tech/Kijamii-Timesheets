/**
 * The line at the top of the timesheet.
 *
 * It reads the person's own month and changes with it, which is the whole
 * point: a fixed slogan becomes wallpaper by the third day, and a line that
 * knows whether you are up to date is worth glancing at.
 *
 * It also changes every day. Only the praise lines used to -- every other
 * state had exactly one sentence, so somebody sitting at half a month saw the
 * same words every morning until their coverage changed, which is precisely
 * how a line stops being read. Each state now has its own set, and the day
 * walks a shuffled order through it: no line comes back until every other one
 * in its set has had a turn, and the order is different on the next lap.
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

/** A line, or a line that needs a number from the month to finish it. */
interface Line {
  emoji: string;
  text: string | ((coverage: MonthCoverage) => string);
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/**
 * Nothing has happened this month yet, because the month has not happened.
 * Nothing to praise and nothing to chase.
 */
const FRESH_MONTH: Line[] = [
  { emoji: "🌱", text: "A fresh month. Nothing to catch up on yet." },
  { emoji: "📄", text: "Blank month. Enjoy it while it lasts." },
  { emoji: "🌤️", text: "New month, nothing owed. A rare combination." },
  { emoji: "🧭", text: "Month one, day one. Everything from here is easier than starting." },
  { emoji: "🫖", text: "Nothing due yet. This is the calmest this page will be all month." },
  { emoji: "🪟", text: "A clean month: nothing outstanding, nothing to remember." },
  { emoji: "🌅", text: "Fresh month. The page is empty and so is your conscience." },
];

/** Two working days in is not behind, whatever an empty month looks like. */
const CLEAN_SLATE: Line[] = [
  { emoji: "✨", text: "New month, clean slate. Whatever you log today sets the tone for it." },
  { emoji: "🎬", text: "Early days. Log today and the rest of the month follows itself." },
  { emoji: "🧱", text: "The month is two days old. Start now and you never have to catch up." },
  { emoji: "🚿", text: "Clean slate. The easiest month to keep up with is one you start on time." },
  { emoji: "🌿", text: "No catching up to do. Today is the cheapest day to log all month." },
  { emoji: "🔑", text: "One entry today and this month never becomes a chore." },
  { emoji: "🪴", text: "New month. Whatever habit you start this week is the one you keep." },
];

/** The month is under way and nothing is logged. Point at today, not the pile. */
const NOT_STARTED: Line[] = [
  { emoji: "🌱", text: "Nothing logged this month yet. Today is the easiest day to start with." },
  { emoji: "☕", text: "Empty month so far. One row today and it stops being empty." },
  { emoji: "🎈", text: "No entries yet this month. Today only takes a minute." },
  { emoji: "🚪", text: "Nothing in yet. Start with today — yesterday will keep." },
  { emoji: "🧩", text: "A blank month. The first entry is the only difficult one." },
  { emoji: "🕰️", text: "Nothing logged yet. Today is the one you still remember clearly." },
  { emoji: "📌", text: "Start with today. The rest of the month is a smaller problem after that." },
];

/**
 * Every working day accounted for. The strongest praise in the file, and the
 * only place a total is quoted -- because here it is a fact about diligence
 * rather than a target being kept score of.
 */
const COMPLETE: Line[] = [
  {
    emoji: "🏆",
    text: (c) =>
      `Every working day this month is accounted for. All ${c.workingDaysSoFar} of them.`,
  },
  { emoji: "🎯", text: "Not one day missing this month. That is genuinely rare." },
  { emoji: "🥇", text: "A complete month. Nothing outstanding, nothing to chase." },
  { emoji: "🧊", text: "Spotless. Every working day this month has hours against it." },
  { emoji: "🛡️", text: "Full coverage this month. Nobody will be asking you for anything." },
  {
    emoji: "📚",
    text: (c) => `${c.workingDaysSoFar} working days, ${c.workingDaysSoFar} logged. Immaculate.`,
  },
  { emoji: "🌟", text: "Complete month. You are the reason the reports make sense." },
];

/**
 * Lines for somebody who is keeping up. These are the jokes -- they are only
 * ever shown to people who have earned them, because a gag about how nobody
 * enjoys timesheets lands very differently on somebody who is behind.
 */
const KEEPING_UP: Line[] = [
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
  { emoji: "🚀", text: "You are ahead of almost everyone reading the same sentence." },
  { emoji: "🧮", text: "Your row in the report adds up. That is not true of every row." },
  { emoji: "🪄", text: "Consistent timesheets are the least glamorous superpower in the agency." },
  { emoji: "☑️", text: "Nearly there. The last few days will take less time than reading this." },
  { emoji: "🎼", text: "You have a rhythm going. Rhythms are much easier to keep than to start." },
  { emoji: "🧊", text: "Cool, calm, almost entirely logged." },
  { emoji: "🔋", text: "Still going. Most people's good intentions ran out a fortnight ago." },
  { emoji: "🏅", text: "Whatever you are doing to remember this, keep doing it." },
];

/** Halfway-ish. Warm, specific, and never a telling-off. */
const KEEPING_PACE: Line[] = [
  {
    emoji: "👋",
    text: (c) =>
      `${days(c.missing.length)} still open this month. They fill in faster than you would think.`,
  },
  {
    emoji: "🧺",
    text: (c) => `${days(c.missing.length)} left to tidy up. Small job, and then it is done.`,
  },
  {
    emoji: "🪁",
    text: (c) => `More logged than not. ${days(c.missing.length)} to go.`,
  },
  {
    emoji: "🧭",
    text: (c) =>
      `${days(c.missing.length)} outstanding. Pick the one you remember best and start there.`,
  },
  {
    emoji: "🍵",
    text: (c) =>
      `${days(c.missing.length)} open. That is a cup of tea's worth of work, not an afternoon.`,
  },
  { emoji: "🧗", text: "Past the halfway mark. The rest is downhill from here." },
  { emoji: "🪜", text: "Most of the month is in. The remaining days go quickly in one sitting." },
  {
    emoji: "🎣",
    text: (c) => `${days(c.missing.length)} still waiting. None of them will take long.`,
  },
  { emoji: "🧶", text: "A few loose ends this month. Worth pulling them together today." },
  { emoji: "🚲", text: "You are more than halfway. Coasting from here is allowed." },
];

/**
 * Behind. Name one next step, never the backlog: a single action is doable
 * where a pile is only discouraging.
 */
const BEHIND: Line[] = [
  {
    emoji: "☕",
    text: "Some days are still empty. Start with the most recent one — the rest gets easier after that.",
  },
  { emoji: "🧩", text: "A few gaps this month. Today's entry is the one you still remember." },
  { emoji: "🌤️", text: "Some catching up to do. Do one day, not all of them." },
  { emoji: "🪁", text: "Start with yesterday. It is the cheapest one to remember." },
  { emoji: "🧭", text: "Pick any one empty day. Momentum does the rest." },
  { emoji: "🍀", text: "Nobody is keeping score. Log one day and you are moving." },
  { emoji: "🫱", text: "Plenty of days open. One at a time is the only way anybody does this." },
  { emoji: "🛋️", text: "Five minutes now saves an unpleasant hour at the end of the month." },
  { emoji: "🔦", text: "Start anywhere. The hardest part is deciding which day to do first." },
  { emoji: "🧊", text: "It is smaller than it feels. One entry proves that." },
];

/** Deterministic PRNG, so the same day produces the same order everywhere. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Which line today gets, out of a set, without repeating one until the set is
 * exhausted.
 *
 * A plain `day % length` would also change daily, but it walks the list in
 * order and identically every lap, so the sequence becomes learnable and the
 * set reads as a loop. This shuffles the order once per lap instead: within a
 * lap every line appears exactly once, and the next lap is a different order.
 */
export function pickForDay<T>(options: readonly T[], today: Date): T {
  const day = Math.floor(today.getTime() / 86_400_000);
  const len = options.length;
  const lap = Math.floor(day / len);
  const random = mulberry32(lap + 1);

  const order = options.map((_, index) => index);
  for (let i = len - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }

  // Positive modulo: dates before the epoch would otherwise index backwards.
  return options[order[((day % len) + len) % len]!]!;
}

function note(lines: Line[], tone: NoteTone, coverage: MonthCoverage, today: Date): DailyNote {
  const line = pickForDay(lines, today);
  return {
    emoji: line.emoji,
    text: typeof line.text === "function" ? line.text(coverage) : line.text,
    tone,
  };
}

/**
 * @param coverage This month's working days, logged and missing.
 * @param today    Injected so the choice is testable rather than clock-dependent.
 */
export function dailyNote(coverage: MonthCoverage, today: Date = new Date()): DailyNote {
  const { missing, logged, workingDaysSoFar, completion } = coverage;

  // A month that has not really started yet.
  if (workingDaysSoFar === 0) return note(FRESH_MONTH, "invite", coverage, today);

  // A month one or two working days old is not a month somebody is behind on.
  // Without this, every person in the company opens the first of the month to
  // the most remedial line in the file, which is both untrue and a poor way to
  // start four weeks of asking them for something.
  if (logged.length === 0 && workingDaysSoFar <= 2) {
    return note(CLEAN_SLATE, "invite", coverage, today);
  }

  if (logged.length === 0) return note(NOT_STARTED, "invite", coverage, today);
  if (missing.length === 0) return note(COMPLETE, "praise", coverage, today);
  if (completion >= 0.8) return note(KEEPING_UP, "praise", coverage, today);
  if (completion >= 0.5) return note(KEEPING_PACE, "steady", coverage, today);
  return note(BEHIND, "invite", coverage, today);
}

/** Every set, for the test that proves none of them ever repeats within a lap. */
export const NOTE_SETS = {
  FRESH_MONTH,
  CLEAN_SLATE,
  NOT_STARTED,
  COMPLETE,
  KEEPING_UP,
  KEEPING_PACE,
  BEHIND,
};
