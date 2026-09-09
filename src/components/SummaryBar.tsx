import { ChevronUp, Loader2, Save, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dayLabel } from "@/lib/domain/week";
import { useTimesheet } from "@/lib/timesheet-store";

/**
 * Save and submit, and nothing else.
 *
 * This bar used to carry a running scoreboard -- hours against forty, a
 * billable split, hours remaining, a status pill. All of it is gone. A total
 * kept on screen while somebody is deciding what to write is a number being
 * managed rather than a record being kept, and "Remaining 33.75h" named the
 * exact figure to invent. What was actually logged is still in the rows, in
 * the submit dialog's receipt, and on the admin page, where it is read-only
 * and belongs to somebody else.
 */
export function SummaryBar({
  onSubmitDay,
  onSubmitWeek,
}: {
  onSubmitDay: (date: string) => void;
  onSubmitWeek: () => void;
}) {
  const { saveDraft, dirty, submitting, isDayLocked, selectableDates, entries } = useTimesheet();

  /**
   * Every day that can still be submitted on its own: it has happened, it has
   * entries, and it is not already locked. Listing them means a day can be
   * submitted after the fact -- catching up on Thursday still lets Monday be
   * closed off separately.
   */
  const daysWithEntries = selectableDates.filter((date) =>
    entries.some((row) => row.workDate === date),
  );

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t bg-surface/95 px-4 py-3 shadow-raised backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void saveDraft()}
          disabled={!dirty || submitting}
        >
          <Save className="size-3.5" /> Save draft
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* Disabled while a submission is in flight, so a double
                      click cannot start a second one. */}
            <Button size="sm" className="gap-2 px-4" disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              {submitting ? "Submitting…" : "Submit"}
              <ChevronUp className="size-3.5 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-64">
            {daysWithEntries.length > 0 && (
              <>
                <DropdownMenuLabel className="label-xs">Submit a single day</DropdownMenuLabel>
                {/* A day can be submitted again. Adding rows to a day that
                      was already sent is allowed, so refusing to send them
                      would be a dead end: the rows would sit there forever
                      with no way out. What decides the state here is whether
                      anything on the day is still a draft, never whether the
                      day was submitted before. */}
                {daysWithEntries.map((date) => {
                  const pending = entries.filter(
                    (row) => row.workDate === date && row.status === "draft",
                  ).length;
                  const sentBefore = isDayLocked(date);
                  return (
                    <DropdownMenuItem
                      key={date}
                      disabled={pending === 0}
                      onClick={() => pending > 0 && onSubmitDay(date)}
                    >
                      {dayLabel(date)}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {pending === 0
                          ? "sent"
                          : sentBefore
                            ? `${pending} new`
                            : `${pending} row${pending === 1 ? "" : "s"}`}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={onSubmitWeek}>Submit whole week</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
