import { Fragment } from "react";
import { addDays } from "date-fns";
import { AlertCircle, ChevronLeft, Copy, Lock, Plus, Trash2 } from "lucide-react";

import { EntryField } from "@/components/EntryField";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHours } from "@/lib/domain/totals";
import { dayLabel, parseDateKey, shortDayLabel, toDateKey } from "@/lib/domain/week";
import type { TimesheetEntry } from "@/lib/domain/types";
import { useTimesheet } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

function RowActions({ row }: { row: TimesheetEntry }) {
  const { duplicateRow, deleteRow } = useTimesheet();
  // Submitting reports a row; it does not put it beyond correction. The badge
  // says what was sent, the buttons stay.
  return (
    <div className="flex items-center gap-0.5">
      {row.status !== "draft" && (
        <span className="mr-1 text-[11px] text-muted-foreground">Sent</span>
      )}
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
  const { totals, isDayLocked, addRow, focusDate } = useTimesheet();
  const day = totals.byDay.find((entry) => entry.date === date);
  const locked = isDayLocked(date);
  const isToday = date === focusDate && date === toDateKey(new Date());

  return (
    <>
      {/* The anchor for everything beneath it, and it was set in the same
          11px as the small print. Whoever is filling this in needs to know
          which day they are typing into without hunting for it. */}
      <span className="num text-[15px] font-bold">{dayLabel(date)}</span>
      {isToday && (
        <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
          Today
        </span>
      )}
      {/* No running figure for the day. "2h / 8h" named the shortfall, and
          "2h" on its own is still a score being kept in front of somebody
          while they decide what to write. A non-working day is a fact about
          the calendar rather than a measurement, so that stays. */}
      {day && day.expected === 0 && (
        <span className="ml-2 text-muted-foreground">non-working day</span>
      )}
      {locked && (
        <span className="ml-2 rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
          Submitted
        </span>
      )}
      {/* The most-used control on the page, and it used to be the faintest
          thing on its row. Filled rather than outlined so it reads as the
          primary action of the day it sits on, in the theme's success green so
          it holds its contrast in both modes. White text is set explicitly:
          the token's own foreground follows the theme and would go dark. */}
      <Button
        variant="outline"
        size="sm"
        className="ml-2 h-7 border-transparent bg-success px-2.5 text-[13px] font-bold text-white shadow-card hover:bg-success/90 hover:text-white"
        onClick={() => addRow(date)}
      >
        <Plus className="size-3.5" /> Row
      </Button>
    </>
  );
}

/**
 * Shown when the day on screen is already submitted.
 *
 * That is a real state, not an error. Saying so and offering the day before
 * beats an "Add row" button that produces a row nobody can edit.
 */
function NothingToAdd() {
  const { focusDate, setDay } = useTimesheet();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Lock className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-[12px] text-muted-foreground">
        Everything on {shortDayLabel(focusDate)} has been submitted.
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDay(toDateKey(addDays(parseDateKey(focusDate), -1)))}
      >
        <ChevronLeft className="size-3.5" /> Go to the day before
      </Button>
    </div>
  );
}

export function TimesheetGrid() {
  const {
    config,
    entries,
    addRow,
    visibleDates,
    focusDate,
    defaultEntryDate,
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
        <h2 className="text-sm font-bold">Nothing logged for {shortDayLabel(focusDate)} yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
          {startsToday
            ? "Start with a row for today."
            : "Add a row for this day, or pick another from the strip above."}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {defaultEntryDate && (
            <Button
              size="sm"
              className="h-9 gap-1.5 border-transparent bg-success px-3.5 text-[14px] font-bold text-white shadow-card hover:bg-success/90 hover:text-white"
              onClick={() => addRow(defaultEntryDate)}
            >
              <Plus className="size-4" /> {startsToday ? "Log today's hours" : "Add first row"}
            </Button>
          )}
        </div>
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
                    className={cn("label-col px-2.5 py-3", field.width)}
                  >
                    {field.label}
                    {field.required ? (
                      <span className="ml-0.5 text-brand">*</span>
                    ) : (
                      <span className="ml-1.5 text-[12px] font-medium normal-case tracking-normal text-muted-foreground">
                        Optional
                      </span>
                    )}
                  </th>
                ))}
                <th scope="col" className="label-col w-[84px] px-2.5 py-3">
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
                        className="px-2.5 py-2.5 text-left text-[12px] font-semibold"
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
        <div className="flex flex-wrap items-center gap-2 border-t bg-surface-muted px-2.5 py-2">
          {defaultEntryDate ? (
            <span className="text-[11px] text-muted-foreground">
              Tip: press Tab to move across fields, Shift+Tab to go back.
            </span>
          ) : (
            <NothingToAdd />
          )}
        </div>
      </div>

      {/* Mobile and tablet cards — every field is preserved, not truncated */}
      <div className="space-y-3 lg:hidden">
        {visibleDates.map((date) => {
          const dayRows = entries.filter((row) => row.workDate === date);
          return (
            <section key={date} className="space-y-2">
              <header className="flex flex-wrap items-center gap-x-2 gap-y-1 px-0.5 text-[12px] font-semibold">
                <DayHeading date={date} />
              </header>
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
                          <p className="label-col mb-1">
                            {field.label}
                            {field.required ? (
                              <span className="ml-0.5 text-brand">*</span>
                            ) : (
                              <span className="ml-1.5 text-[12px] font-medium normal-case tracking-normal text-muted-foreground">
                                Optional
                              </span>
                            )}
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
        {!defaultEntryDate && <NothingToAdd />}
      </div>
    </div>
  );
}
