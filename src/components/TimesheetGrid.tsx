import { Fragment } from "react";
import { AlertCircle, Copy, Loader2, Plus, Trash2 } from "lucide-react";

import { EntryField } from "@/components/EntryField";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHours } from "@/lib/domain/totals";
import { dayLabel, shortDayLabel, toDateKey } from "@/lib/domain/week";
import type { TimesheetEntry } from "@/lib/domain/types";
import { useTimesheet } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

function RowActions({ row }: { row: TimesheetEntry }) {
  const { duplicateRow, deleteRow, readOnly, isDayLocked } = useTimesheet();
  if (readOnly || isDayLocked(row.workDate)) {
    return <span className="text-[11px] text-muted-foreground">Locked</span>;
  }
  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label="Duplicate row"
        onClick={() => duplicateRow(row.id)}
      >
        <Copy className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        aria-label="Delete row"
        onClick={() => deleteRow(row.id)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function DayHeading({ date }: { date: string }) {
  const { totals, isDayLocked, readOnly, addRow, focusDate, selectableDates } = useTimesheet();
  const day = totals.byDay.find((entry) => entry.date === date);
  const locked = isDayLocked(date);
  const isToday = date === focusDate && date === toDateKey(new Date());
  // A day that has not happened yet cannot be submitted, so nothing invites
  // adding to it. It only appears at all if a row was filed there earlier.
  const upcoming = !selectableDates.includes(date);

  return (
    <>
      <span className="num">{dayLabel(date)}</span>
      {isToday && (
        <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand">
          Today
        </span>
      )}
      {upcoming && (
        <span className="ml-2 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">
          Upcoming — move these to a day that has happened
        </span>
      )}
      <span
        className={cn(
          "num ml-2 text-muted-foreground",
          day && day.expected > 0 && day.hours < day.expected && "text-warning",
        )}
      >
        {formatHours(day?.hours ?? 0)}
        {day?.expected ? ` / ${formatHours(day.expected)}` : " · non-working day"}
      </span>
      {locked ? (
        <span className="ml-2 rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
          Day submitted
        </span>
      ) : (
        !readOnly &&
        !upcoming && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 h-6 px-1.5 text-[11px]"
            onClick={() => addRow(date)}
          >
            <Plus className="size-3" /> Row
          </Button>
        )
      )}
    </>
  );
}

/**
 * Reveals a past day of this week. A list rather than a single button, so
 * catching up on Thursday reaches Monday in one click instead of three.
 */
function AddDayMenu({ className }: { className?: string | undefined }) {
  const { hiddenDates, addDay } = useTimesheet();
  if (hiddenDates.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Plus className="size-3.5" /> Add day
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {hiddenDates.map((date) => (
          <DropdownMenuItem key={date} onClick={() => addDay(date)} className="text-[13px]">
            {dayLabel(date)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TimesheetGrid() {
  const {
    config,
    entries,
    addRow,
    readOnly,
    visibleDates,
    focusDate,
    loading,
    loadError,
    reload,
    issueFor,
    reference,
  } = useTimesheet();

  if (loading || !reference) {
    return (
      <div className="space-y-2 rounded-lg border bg-surface p-4 shadow-card">
        <span className="sr-only">Loading this week</span>
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-destructive">
          <AlertCircle className="size-4" /> This week could not be loaded
        </p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">{loadError}</p>
        <Button className="mt-4" size="sm" variant="outline" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }

  if (entries.length === 0) {
    const startsToday = focusDate === toDateKey(new Date());
    return (
      <div className="rounded-lg border border-dashed bg-surface px-6 py-14 text-center">
        <p className="text-sm font-semibold">
          {startsToday
            ? `Nothing logged for ${shortDayLabel(focusDate)} yet`
            : "No entries for this week yet"}
        </p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
          {readOnly
            ? "Nothing was logged for this week."
            : "Add a row, or copy last week's entries and adjust the hours."}
        </p>
        {!readOnly && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => addRow(focusDate)}>
              <Plus className="size-3.5" /> {startsToday ? "Log today's hours" : "Add first row"}
            </Button>
            {/* Catching up on the whole week starts from an earlier day. */}
            <AddDayMenu />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border bg-surface shadow-card lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] border-collapse text-left">
            <caption className="sr-only">
              Timesheet entries grouped by day. Use Tab to move between fields.
            </caption>
            <thead>
              <tr className="border-b bg-surface-muted">
                {config.fields.map((field) => (
                  <th
                    key={field.key}
                    scope="col"
                    className={cn("label-xs px-2.5 py-2.5", field.width)}
                  >
                    {field.label}
                    {field.required && <span className="ml-0.5 text-brand">*</span>}
                  </th>
                ))}
                <th scope="col" className="label-xs w-[84px] px-2.5 py-2.5">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleDates.map((date) => {
                const dayRows = entries.filter((row) => row.workDate === date);
                return (
                  <Fragment key={date}>
                    <tr className="border-b bg-background/70">
                      <th
                        scope="colgroup"
                        colSpan={config.fields.length + 1}
                        className="px-2.5 py-1.5 text-left text-[11px] font-semibold"
                      >
                        <DayHeading date={date} />
                      </th>
                    </tr>
                    {dayRows.map((row) => {
                      const issue = issueFor(row.id);
                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "border-b align-middle last:border-b-0 hover:bg-surface-muted/60",
                            issue && "bg-destructive/5",
                          )}
                        >
                          {config.fields.map((field) => (
                            <td key={field.key} className={cn("px-1.5 py-1", field.width)}>
                              <EntryField
                                field={field}
                                row={row}
                                invalid={issue?.fields.includes(field.key)}
                              />
                            </td>
                          ))}
                          <td className="px-1.5 py-1">
                            <RowActions row={row} />
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 border-t bg-surface-muted px-2.5 py-2">
            <Button variant="ghost" size="sm" onClick={() => addRow()}>
              <Plus className="size-3.5" /> Add another row
            </Button>
            <AddDayMenu />
            <span className="text-[11px] text-muted-foreground">
              Tip: press Tab to move across fields, Shift+Tab to go back.
            </span>
          </div>
        )}
      </div>

      {/* Mobile and tablet cards — every field is preserved, not truncated */}
      <div className="space-y-3 lg:hidden">
        {visibleDates.map((date) => {
          const dayRows = entries.filter((row) => row.workDate === date);
          return (
            <section key={date} className="space-y-2">
              <header className="flex flex-wrap items-center gap-x-2 px-0.5 text-[12px] font-semibold">
                <DayHeading date={date} />
              </header>
              {dayRows.length === 0 && !readOnly && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => addRow(date)}>
                  <Plus className="size-3.5" /> Add row for {shortDayLabel(date)}
                </Button>
              )}
              {dayRows.map((row) => {
                const issue = issueFor(row.id);
                return (
                  <article
                    key={row.id}
                    className={cn(
                      "rounded-lg border bg-surface p-3 shadow-card",
                      issue && "border-destructive/40",
                    )}
                  >
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                      {config.fields.map((field) => (
                        <div key={field.key} className={cn("min-w-0", field.wide && "col-span-2")}>
                          <p className="label-xs mb-0.5">
                            {field.label}
                            {field.required && <span className="ml-0.5 text-brand">*</span>}
                          </p>
                          <EntryField
                            field={field}
                            row={row}
                            invalid={issue?.fields.includes(field.key)}
                          />
                        </div>
                      ))}
                    </div>
                    {issue && (
                      <p className="mt-2 flex items-start gap-1.5 text-[12px] font-medium text-destructive">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {issue.message}
                      </p>
                    )}
                    <div className="mt-2 flex justify-end border-t pt-2">
                      <RowActions row={row} />
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => addRow()}>
              <Plus className="size-3.5" /> Add row
            </Button>
            <AddDayMenu className="flex-1" />
          </div>
        )}
      </div>

      {readOnly && (
        <p className="text-[12px] text-muted-foreground">
          This week has been submitted and is read-only.
        </p>
      )}
    </div>
  );
}
