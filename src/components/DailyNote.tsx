import { dailyNote } from "@/lib/domain/daily-note";
import type { MonthCoverage } from "@/lib/domain/coverage";
import { cn } from "@/lib/utils";

/**
 * The first thing on the timesheet.
 *
 * It sits above everything because it is the only part of this page that
 * talks back: the grid asks for something, this acknowledges what has already
 * been given. Larger than body text and given the heading colour so it reads
 * as address rather than as small print.
 *
 * The tone shifts with how the month is going. It never scolds -- see
 * `daily-note.ts` for why that rule is load-bearing rather than polite.
 */
export function DailyNote({ coverage }: { coverage: MonthCoverage | null }) {
  // Nothing is shown until the month is known. A note that says one thing and
  // then corrects itself a moment later is worse than a beat of silence.
  if (!coverage) return null;

  const note = dailyNote(coverage);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 shadow-card",
        // Tinted by tone rather than uniformly, so the difference between
        // "you are on top of this" and "there is something to do" is legible
        // before the sentence is read.
        note.tone === "praise" && "border-success/30 bg-success-soft",
        note.tone === "steady" && "border-warning/30 bg-warning-soft",
        note.tone === "invite" && "border-brand/30 bg-brand-soft",
      )}
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        {note.emoji}
      </span>
      <p
        className={cn(
          "min-w-0 text-[17px] leading-snug font-bold tracking-tight",
          note.tone === "praise" && "text-success",
          note.tone === "steady" && "text-warning",
          note.tone === "invite" && "text-brand",
        )}
      >
        {note.text}
      </p>
    </div>
  );
}
