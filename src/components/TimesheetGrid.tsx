import { Fragment } from "react";
import { format } from "date-fns";
import { AlertCircle, Copy, Plus, Trash2 } from "lucide-react";
import { EntryField } from "@/components/EntryField";
import { Button } from "@/components/ui/button";
import { getClient } from "@/data/reference";
import { serviceOptions, taskOptions, projectTypeOptions } from "@/data/timesheet-config";
import type { TimesheetEntry } from "@/data/weeks";
import { weekDays } from "@/data/weeks";
import { useTimesheet } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

const hm = (n: number) => `${n % 1 === 0 ? n : n.toFixed(2)}h`;

function RowActions({ row }: { row: TimesheetEntry }) {
  const { duplicateRow, deleteRow, readOnly, isDayLocked } = useTimesheet();
  if (readOnly || isDayLocked(row.date))
    return <span className="text-[11px] text-muted-foreground">Locked</span>;
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

export function TimesheetGrid() {
  const {
    config,
    entries,
    weekKey,
    addRow,
    issues,
    showErrors,
    readOnly,
    totals,
    marketId,
    visibleDates,
    addDay,
    isDayLocked,
  } = useTimesheet();

  const days = weekDays(weekKey).filter((d) => visibleDates.includes(format(d, "yyyy-MM-dd")));
  const canAddDay = visibleDates.length < 7;
  const issueFor = (id: string) => (showErrors ? issues.find((i) => i.rowId === id) : undefined);

  if (!entries.length) {
    return (
      <div className="rounded-lg border border-dashed bg-surface px-6 py-14 text-center">
        <p className="text-sm font-semibold">No entries for this week yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
          Add your first row, or copy last week's entries and adjust the hours — most weeks take
          under five minutes.
        </p>
        {!readOnly && (
          <Button className="mt-4" size="sm" onClick={() => addRow(format(days[0]!, "yyyy-MM-dd"))}>
            <Plus className="size-3.5" /> Add first row
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-lg border bg-surface shadow-card lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="border-b bg-surface-muted">
                {config.fields.map((f) => (
                  <th key={f.key} className={cn("label-xs px-2.5 py-2.5", f.width)}>
                    {f.label}
                    {f.required && <span className="ml-0.5 text-brand">*</span>}
                  </th>
                ))}
                <th className="label-xs w-[84px] px-2.5 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayRows = entries.filter((r) => r.date === key);
                const dayTotal = totals.byDay.find((d) => d.date === key);
                return (
                  <Fragment key={key}>
                    <tr className="border-b bg-background/70">
                      <td
                        colSpan={config.fields.length + 1}
                        className="px-2.5 py-1.5 text-[11px] font-semibold"
                      >
                        <span className="num">{format(day, "EEEE d MMM")}</span>
                        <span
                          className={cn(
                            "num ml-2 text-muted-foreground",
                            dayTotal &&
                              dayTotal.expected > 0 &&
                              dayTotal.hours < dayTotal.expected &&
                              "text-warning",
                          )}
                        >
                          {hm(dayTotal?.hours ?? 0)}
                          {dayTotal?.expected ? ` / ${hm(dayTotal.expected)}` : " · non-working day"}
                        </span>
                        {isDayLocked(key) ? (
                          <span className="ml-2 rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                            Day submitted
                          </span>
                        ) : (
                          !readOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-1 h-6 px-1.5 text-[11px]"
                              onClick={() => addRow(key)}
                            >
                              <Plus className="size-3" /> Row
                            </Button>
                          )
                        )}
                      </td>
                    </tr>
                    {!dayRows.length && !readOnly && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => addRow(key)}>
                  <Plus className="size-3.5" /> Add row for {format(day, "EEE d MMM")}
                </Button>
              )}
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
                          {config.fields.map((f) => (
                            <td key={f.key} className={cn("px-1.5 py-1", f.width)}>
                              <EntryField
                                field={f}
                                row={row}
                                invalid={issue?.fields.includes(f.key)}
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
          <div className="flex items-center gap-2 border-t bg-surface-muted px-2.5 py-2">
            <Button variant="ghost" size="sm" onClick={() => addRow()}>
              <Plus className="size-3.5" /> Add another row
            </Button>
            {canAddDay && (
              <Button variant="outline" size="sm" onClick={addDay}>
                <Plus className="size-3.5" /> Add day
              </Button>
            )}
            <span className="text-[11px] text-muted-foreground">
              Tip: press Tab to move across fields, Shift+Tab to go back.
            </span>
          </div>
        )}
      </div>

      {/* Mobile / small tablet cards — all fields preserved */}
      <div className="space-y-3 lg:hidden">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayRows = entries.filter((r) => r.date === key);
          if (!dayRows.length) return null;
          const dayTotal = totals.byDay.find((d) => d.date === key);
          return (
            <section key={key} className="space-y-2">
              <header className="flex items-center justify-between px-0.5">
                <p className="num flex items-center gap-2 text-[12px] font-semibold">
                  {format(day, "EEEE d MMM")}
                  {isDayLocked(key) && (
                    <span className="rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                      Submitted
                    </span>
                  )}
                </p>
                <p className="num text-[12px] text-muted-foreground">
                  {hm(dayTotal?.hours ?? 0)}
                  {dayTotal?.expected ? ` / ${hm(dayTotal.expected)}` : ""}
                </p>
              </header>
              {!dayRows.length && !readOnly && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => addRow(key)}>
                  <Plus className="size-3.5" /> Add row for {format(day, "EEE d MMM")}
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
                      {config.fields.map((f) => (
                        <div
                          key={f.key}
                          className={cn(
                            "min-w-0",
                            (f.key === "task" || f.key === "notes") && "col-span-2",
                          )}
                        >
                          <p className="label-xs mb-0.5">
                            {f.label}
                            {f.required && <span className="ml-0.5 text-brand">*</span>}
                          </p>
                          <EntryField
                            field={f}
                            row={row}
                            invalid={issue?.fields.includes(f.key)}
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
            {canAddDay && (
              <Button variant="outline" size="sm" className="flex-1" onClick={addDay}>
                <Plus className="size-3.5" /> Add day
              </Button>
            )}
          </div>
        )}
      </div>

      {readOnly && (
        <p className="text-[12px] text-muted-foreground">
          Submitted week for {marketId} — entries are read-only.
        </p>
      )}
      {/* Screen-reader friendly summary of the selected row context */}
      <span className="sr-only">
        {entries
          .map(
            (r) =>
              `${getClient(r.clientId)?.name ?? ""} ${
                serviceOptions.find((s) => s.id === r.serviceId)?.name ?? ""
              } ${projectTypeOptions.find((p) => p.id === r.projectType)?.name ?? ""} ${
                taskOptions.find((t) => t.id === r.task)?.name ?? ""
              } ${r.notes}`,
          )
          .join(", ")}
      </span>
    </div>
  );
}
