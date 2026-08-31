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
    <p
      className={cn(
        "flex items-start gap-2.5 text-[15px] leading-relaxed font-semibold",
        note.tone === "praise" && "text-heading",
        note.tone === "steady" && "text-foreground/85",
        note.tone === "invite" && "text-foreground/85",
      )}
    >
      <span aria-hidden="true" className="text-lg leading-tight">
        {note.emoji}
      </span>
      <span className="min-w-0">{note.text}</span>
    </p>
  );
}
