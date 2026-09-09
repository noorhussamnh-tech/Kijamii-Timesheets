import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { currentWeekKey, parseDateKey, shiftWeek, weekEnd } from "@/lib/domain/week";

/** A whole week, by its Sunday. The shape the timesheet itself is filed in. */
function week(offset: number): DateRange {
  const key = shiftWeek(currentWeekKey(), offset);
  return { from: parseDateKey(key), to: parseDateKey(weekEnd(key)) };
}

function month(offset: number): DateRange {
  const anchor = subMonths(new Date(), offset);
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

/**
 * The shortcuts worth having, because most questions are one of these.
 *
 * The calendar is there for the ones that are not -- a campaign, a notice
 * period, the fortnight somebody was away -- but making every routine
 * question cost two clicks in a date grid would be a poor trade for that
 * flexibility.
 */
const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "This week", range: () => week(0) },
  { label: "Last week", range: () => week(-1) },
  { label: "This month", range: () => month(0) },
  { label: "Last month", range: () => month(1) },
];

/** How a range reads when both ends fall in the same month, and when they do not. */
export function rangeLabel(from: Date, to: Date): string {
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  return sameMonth
    ? `${format(from, "d")} – ${format(to, "d MMM yyyy")}`
    : `${format(from, "d MMM")} – ${format(to, "d MMM yyyy")}`;
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: { from: Date; to: Date };
  onChange: (range: { from: Date; to: Date }) => void;
}) {
  const [open, setOpen] = useState(false);
  // Held separately while the calendar is open: picking a range takes two
  // clicks, and reloading the page against a half-chosen one would fire a
  // query for a single day nobody asked about.
  const [draft, setDraft] = useState<DateRange | undefined>(value);

  const commit = (next: DateRange | undefined) => {
    setDraft(next);
    if (next?.from && next.to) {
      onChange({ from: next.from, to: next.to });
      setOpen(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(value);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 gap-2 px-3 text-[13px] font-normal">
          <CalendarDays className="size-3.5 opacity-70" />
          <span className="num">{rangeLabel(value.from, value.to)}</span>
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-auto gap-3 p-3">
        <div className="flex w-[132px] shrink-0 flex-col gap-1">
          <p className="label-xs px-1 pb-1">Quick ranges</p>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                const next = preset.range();
                setDraft(next);
                if (next.from && next.to) {
                  onChange({ from: next.from, to: next.to });
                  setOpen(false);
                }
              }}
              className="rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-surface-muted"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          defaultMonth={value.from}
          selected={draft}
          onSelect={commit}
          weekStartsOn={0}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
