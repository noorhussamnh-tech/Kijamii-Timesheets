import { useMemo } from "react";
import { format } from "date-fns";

import { FillMark } from "@/components/FillMark";
import { fillTextClass } from "@/components/fill-marks";
import type { ExportRow } from "@/lib/data/api";
import { fillLevel, formatHours } from "@/lib/domain/totals";
import type { AdminEmployeeStatus } from "@/lib/domain/types";
import { parseDateKey } from "@/lib/domain/week";
import { cn } from "@/lib/utils";

/**
 * A person's week, or month, as one line across.
 *
 * The grid answers the question a lead actually opens this page with -- who is
 * filling this in, and what are they on -- in one look, because the shape
 * carries the answer before any number is read. A row that trails off into
 * hatching is somebody who stopped; a row of pale cells is somebody logging an
 * hour a day; the one bright cell in a quiet row is the day something landed.
 *
 * Reading down a column instead answers a different question for free: a
 * Tuesday where the whole team is hatched is not fifteen people forgetting, it
 * is a public holiday, and nobody needs chasing.
 *
 * Hatched is not zero. Zero is a day somebody logged and accounted for as
 * empty; hatched is a day nobody answered for. Treating them as the same thing
 * is how a chase list ends up chasing the wrong people.
 *
 * Accounts sit under the hours because "seven hours" is not the useful half of
 * the answer. Two names fit; past that the cell says how many more and the
 * tooltip has the rest, which keeps a heavy day from pushing every other row
 * out of line.
 */

/** A column: one day, or one month when the range is too long for days. */
interface Column {
  key: string;
  label: string;
  note: string;
  /** Egypt and Saudi both rest on Friday, so the column is marked rather than
   *  left to look like fifteen people who forgot. */
  quiet: boolean;
}

function buildColumns(from: string, to: string): { columns: Column[]; byMonth: boolean } {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

  // Past five weeks a day per column is unreadable, so the grid changes its
  // mind rather than growing a scrollbar nobody reaches the end of.
  if (days > 35) {
    const columns: Column[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      columns.push({
        key: format(cursor, "yyyy-MM"),
        label: format(cursor, "MMM"),
        note: format(cursor, "yyyy"),
        quiet: false,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { columns, byMonth: true };
  }

  const columns: Column[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dow = day.getDay();
    columns.push({
      key: format(day, "yyyy-MM-dd"),
      label: format(day, "d"),
      note: format(day, "EEE"),
      quiet: dow === 5 || dow === 6,
    });
  }
  return { columns, byMonth: false };
}

interface Cell {
  hours: number;
  accounts: string[];
}

/*
 * The five steps, written out.
 *
 * Not built as `heat-${n}`: Tailwind reads the source as text, so a class
 * assembled at runtime is a class it never generates, and the grid renders
 * with no colour at all. Caught by looking at it rather than by any test,
 * which is the only way this particular mistake is ever caught.
 */
const HEAT = ["heat-1", "heat-2", "heat-3", "heat-4", "heat-5"] as const;

/** Which of the five steps a cell sits on, by its share of the busiest one. */
function heatClass(hours: number, busiest: number): string {
  if (hours <= 0 || busiest <= 0) return HEAT[0];
  const share = hours / busiest;
  if (share > 0.8) return HEAT[4];
  if (share > 0.6) return HEAT[3];
  if (share > 0.4) return HEAT[2];
  if (share > 0.2) return HEAT[1];
  return HEAT[0];
}

export function TeamGrid({
  people,
  entries,
  from,
  to,
}: {
  people: AdminEmployeeStatus[];
  entries: ExportRow[];
  from: string;
  to: string;
}) {
  const { columns, byMonth } = useMemo(() => buildColumns(from, to), [from, to]);

  const { cells, busiest } = useMemo(() => {
    const map = new Map<string, Cell>();
    let top = 0;
    for (const row of entries) {
      const when = byMonth ? row.workDate.slice(0, 7) : row.workDate;
      const key = `${row.employeeEmail.toLowerCase()}|${when}`;
      const cell = map.get(key) ?? { hours: 0, accounts: [] };
      cell.hours += Number(row.hours);
      const account = row.clientName ?? "";
      if (account && !cell.accounts.includes(account)) cell.accounts.push(account);
      map.set(key, cell);
      if (cell.hours > top) top = cell.hours;
    }
    return { cells: map, busiest: top };
  }, [entries, byMonth]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-xs">
          {byMonth ? "Recorded hours per person per month" : "Recorded hours per person per day"}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          <span className="heat-0 size-3 rounded-[3px] border" aria-hidden="true" />
          Hatched = nothing submitted
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-[3px] p-1.5 text-left text-[13px]">
            <caption className="sr-only">
              Hours each person submitted, one column per {byMonth ? "month" : "day"}. A hatched
              cell means nothing was submitted.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="label-xs sticky left-0 z-10 bg-surface px-2 py-1.5">
                  Employee
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      "px-1.5 py-1.5 text-center text-[11px] font-semibold",
                      column.quiet ? "text-muted-foreground/60" : "text-muted-foreground",
                    )}
                  >
                    <span className="num block leading-tight">{column.label}</span>
                    <span className="block text-[10px] font-normal">{column.note}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const level = fillLevel(person.totalHours, person.expectedHours);
                return (
                  <tr key={person.employeeId}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 max-w-[220px] bg-surface px-2 py-1 font-medium"
                    >
                      <span className="flex items-center gap-1.5">
                        <FillMark level={level} />
                        <span className={cn("truncate", fillTextClass(level))}>{person.name}</span>
                      </span>
                    </th>
                    {columns.map((column) => {
                      const cell = cells.get(`${person.email.toLowerCase()}|${column.key}`);
                      const accounts = cell?.accounts ?? [];
                      const shown = accounts.slice(0, 2);
                      const rest = accounts.length - shown.length;
                      return (
                        <td
                          key={column.key}
                          title={
                            cell
                              ? `${person.name} · ${column.note} ${column.label} · ${formatHours(cell.hours)}${
                                  accounts.length > 0 ? ` · ${accounts.join(", ")}` : ""
                                }`
                              : `${person.name} · ${column.note} ${column.label} · nothing submitted`
                          }
                          className={cn(
                            "min-w-[72px] rounded-md px-1.5 py-1 text-center align-middle",
                            cell ? heatClass(cell.hours, busiest) : "heat-0",
                          )}
                        >
                          {cell ? (
                            <>
                              <span className="num block text-[13px] font-bold">
                                {formatHours(cell.hours)}
                              </span>
                              {shown.length > 0 && (
                                <span className="block truncate text-[10px] leading-tight opacity-80">
                                  {shown.join(", ")}
                                  {rest > 0 && ` +${rest}`}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[13px] text-muted-foreground/50">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
