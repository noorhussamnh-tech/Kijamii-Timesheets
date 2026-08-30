import { ChevronUp, Loader2, Save, Send } from "lucide-react";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  const { totals, status, readOnly, saveDraft, dirty, submitting, visibleDates, isDayLocked } =
    useTimesheet();

  const openDays = visibleDates.filter((date) => !isDayLocked(date));
  const targetDay = openDays[openDays.length - 1];

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t bg-surface/95 px-4 py-3 shadow-raised backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5 lg:gap-6">
          <Stat label="Total" value={formatHours(totals.total)} />
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
          {readOnly ? (
            <span className="text-[12px] text-muted-foreground">
              Submitted weeks are read-only. Ask an admin to reopen it if something needs changing.
            </span>
          ) : (
            <>
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
                <DropdownMenuContent align="end" side="top" className="w-56">
                  <DropdownMenuItem
                    disabled={!targetDay}
                    onClick={() => targetDay && onSubmitDay(targetDay)}
                  >
                    Submit {targetDay ? dayLabel(targetDay) : "day"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onSubmitWeek}>Submit whole week</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
