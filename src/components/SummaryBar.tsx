import { ChevronUp, Loader2, Save, Send } from "lucide-react";

import { ProgressRing } from "@/components/ProgressRing";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatHours } from "@/lib/domain/totals";
import { dayLabel } from "@/lib/domain/week";
import { useTimesheet } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "brand" | undefined;
}) {
  return (
    <div className="min-w-0">
      <p className="label-xs">{label}</p>
      <p
        className={cn(
          "num text-[15px] font-bold",
          tone === "warn" && "text-warning",
          tone === "brand" && "text-brand",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function SummaryBar({
  onSubmitDay,
  onSubmitWeek,
}: {
  onSubmitDay: (date: string) => void;
  onSubmitWeek: () => void;
}) {
  const { totals, status, saveDraft, dirty, submitting, isDayLocked, selectableDates, entries } =
    useTimesheet();

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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <ProgressRing value={totals.total} target={totals.expected} />
          <Stat label="Billable" value={formatHours(totals.billable)} />
          <Stat label="Non-billable" value={formatHours(totals.nonBillable)} />
          <Stat
            label={totals.excess > 0 ? "Over expected" : "Remaining"}
            value={formatHours(totals.excess > 0 ? totals.excess : totals.missing)}
            tone={totals.missing > 0 ? "warn" : "brand"}
          />
          <div className="min-w-0">
            <p className="label-xs">Status</p>
            <StatusBadge status={status} className="mt-0.5" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );
}
