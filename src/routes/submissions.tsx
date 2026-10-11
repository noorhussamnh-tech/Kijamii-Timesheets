import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { AlertCircle, Pencil } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { fetchMyDays } from "@/lib/data/api";
import { formatHours } from "@/lib/domain/totals";
import type { MyDaySummary } from "@/lib/domain/types";
import { parseDateKey } from "@/lib/domain/week";
import { useTimesheet } from "@/lib/timesheet-store";

export const Route = createFileRoute("/submissions")({
  head: () => ({
    meta: [
      { title: "Previous Submissions — Kijamii Timesheets" },
      {
        name: "description",
        content: "Every day you have logged, with its hours, status and when it was sent.",
      },
      { property: "og:title", content: "Previous Submissions — Kijamii Timesheets" },
      {
        property: "og:description",
        content: "Filter the days you have logged by year and status.",
      },
    ],
  }),
  component: SubmissionsRoute,
});

function SubmissionsRoute() {
  return (
    <AppShell title="Previous Submissions" description="Every day you have logged">
      <Submissions />
    </AppShell>
  );
}

/** "Friday 9 Oct 2026". The year is carried because the list spans years. */
function fullDayLabel(dateKey: string): string {
  return format(parseDateKey(dateKey), "EEEE d MMM yyyy");
}

function Submissions() {
  const { status: authStatus } = useAuth();
  const { setDay } = useTimesheet();
  const navigate = useNavigate();

  const [rows, setRows] = useState<MyDaySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (authStatus !== "ready") return;
    let cancelled = false;
    setError(null);

    void fetchMyDays()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setRows([]);
          setError(cause instanceof Error ? cause.message : "Could not load your days.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const years = useMemo(() => {
    const set = new Set((rows ?? []).map((row) => format(parseDateKey(row.date), "yyyy")));
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [rows]);

  const filtered = useMemo(
    () =>
      (rows ?? []).filter(
        (row) =>
          (year === "all" || format(parseDateKey(row.date), "yyyy") === year) &&
          (statusFilter === "all" || row.status === statusFilter),
      ),
    [rows, year, statusFilter],
  );

  // Opening a day goes to that day. The week it belongs to is loaded behind it,
  // which is the store's business rather than this page's.
  const open = (date: string) => {
    setDay(date);
    void navigate({ to: "/timesheet" });
  };

  if (rows === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="h-9 w-[150px] text-[13px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[160px] text-[13px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-[12px] text-muted-foreground">
          {filtered.length} day{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-surface px-6 py-12 text-center">
          <h2 className="text-sm font-bold">
            {rows.length === 0 ? "Nothing logged yet" : "No days match these filters"}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {rows.length === 0
              ? "Once you log a day it will appear here."
              : "Clear the filters to see every day."}
          </p>
          {rows.length === 0 ? (
            <Button size="sm" className="mt-4" onClick={() => void navigate({ to: "/timesheet" })}>
              Log today
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => {
                setYear("all");
                setStatusFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border bg-surface shadow-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead>
                  <tr className="border-b bg-surface-muted">
                    <th scope="col" className="label-xs px-3 py-2.5">
                      Day
                    </th>
                    <th scope="col" className="label-xs px-3 py-2.5">
                      Entries
                    </th>
                    <th scope="col" className="label-xs px-3 py-2.5 text-right">
                      Total
                    </th>
                    <th scope="col" className="label-xs px-3 py-2.5 text-right">
                      Billable
                    </th>
                    <th scope="col" className="label-xs px-3 py-2.5">
                      Status
                    </th>
                    <th scope="col" className="label-xs px-3 py-2.5">
                      Submitted
                    </th>
                    <th scope="col" className="label-xs px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.date}
                      className="border-b last:border-b-0 hover:bg-surface-muted/60"
                    >
                      <td className="num px-3 py-2.5 font-semibold">{fullDayLabel(row.date)}</td>
                      <td className="num px-3 py-2.5 text-muted-foreground">
                        {row.rowCount} row{row.rowCount === 1 ? "" : "s"}
                      </td>
                      <td className="num px-3 py-2.5 text-right font-semibold">
                        {formatHours(row.totalHours)}
                      </td>
                      <td className="num px-3 py-2.5 text-right">
                        {formatHours(row.billableHours)}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="num px-3 py-2.5 text-muted-foreground">
                        {row.submittedAt ? format(new Date(row.submittedAt), "d MMM · HH:mm") : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => open(row.date)}>
                          <Pencil className="size-3.5" /> Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2 md:hidden">
            {filtered.map((row) => (
              <article key={row.date} className="rounded-lg border bg-surface p-3 shadow-card">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="num truncate text-[13px] font-semibold">
                      {fullDayLabel(row.date)}
                    </p>
                    <p className="num truncate text-[12px] text-muted-foreground">
                      {row.rowCount} row{row.rowCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 border-t pt-2.5">
                  <div>
                    <p className="label-xs">Total</p>
                    <p className="num text-[13px] font-semibold">{formatHours(row.totalHours)}</p>
                  </div>
                  <div>
                    <p className="label-xs">Billable</p>
                    <p className="num text-[13px] font-semibold">
                      {formatHours(row.billableHours)}
                    </p>
                  </div>
                  <div>
                    <p className="label-xs">Submitted</p>
                    <p className="num text-[13px]">
                      {row.submittedAt ? format(new Date(row.submittedAt), "d MMM") : "—"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2.5 w-full"
                  onClick={() => open(row.date)}
                >
                  <Pencil className="size-3.5" /> Edit day
                </Button>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
