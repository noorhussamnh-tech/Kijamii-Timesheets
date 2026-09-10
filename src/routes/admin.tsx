import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { AlertCircle, Search, ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DateRangePicker, rangeLabel } from "@/components/DateRangePicker";
import { ExportCsv } from "@/components/ExportCsv";
import { ExportByClient } from "@/components/ExportByClient";
import { ExportGrouped } from "@/components/ExportGrouped";
import { ExportEmployeeDetail } from "@/components/ExportEmployeeDetail";
import { EmployeeExportMenu } from "@/components/EmployeeExportMenu";
import { SyncDirectory } from "@/components/SyncDirectory";
import { ExportTimeDedication } from "@/components/ExportTimeDedication";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { fetchAdminRange } from "@/lib/data/api";
import { formatHours } from "@/lib/domain/totals";
import { MARKETS, MARKET_LABELS, type AdminEmployeeStatus, type Market } from "@/lib/domain/types";
import { currentWeekKey, parseDateKey, toDateKey, weekEnd } from "@/lib/domain/week";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Overview — Kijamii Timesheets" },
      {
        name: "description",
        content: "Weekly submission status across Kijamii markets and departments.",
      },
      { property: "og:title", content: "Admin Overview — Kijamii Timesheets" },
      {
        property: "og:description",
        content: "Completion rate, submitted, draft and missing timesheets for any period.",
      },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <AppShell title="Admin Overview" description="Submission status for any period">
      <AdminOverview />
    </AppShell>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-surface p-3 shadow-card">
      <p className="label-xs">{label}</p>
      <p className="num mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AdminOverview() {
  const { employee, status: authStatus } = useAuth();
  const isAdmin = employee?.role === "admin";

  /*
   * Any two dates, defaulting to this week -- which is what the page always
   * showed, so nothing moves for somebody who only ever wants the current one.
   */
  const [range, setRange] = useState(() => {
    const key = currentWeekKey();
    return { from: parseDateKey(key), to: parseDateKey(weekEnd(key)) };
  });
  const from = toDateKey(range.from);
  const to = toDateKey(range.to);
  const [rows, setRows] = useState<AdminEmployeeStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [market, setMarket] = useState("all");
  const [department, setDepartment] = useState("all");

  useEffect(() => {
    // The client-side role check only decides what to render. The fetch below
    // is refused by the database for anyone who is not actually an admin.
    if (authStatus !== "ready" || !isAdmin) return;
    let cancelled = false;

    setRows(null);
    setError(null);

    void fetchAdminRange(from, to)
      .then((data: AdminEmployeeStatus[]) => {
        if (!cancelled) setRows(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setRows([]);
          setError(cause instanceof Error ? cause.message : "Could not load the overview.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [from, to, isAdmin, authStatus]);

  const [query, setQuery] = useState("");

  const departments = useMemo(() => {
    const set = new Set((rows ?? []).map((row) => row.department).filter(Boolean));
    return [...set] as string[];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (row) =>
        /*
         * The market a person is in is the entity that employs them, which is
         * what the company employee list records and what decides their
         * working week. It is not `markets`, which is every market whose
         * clients they can pick from -- that is all three for everybody, so
         * filtering on it matched the whole company whichever market was
         * chosen, and the filter appeared to do nothing.
         */
        (market === "all" || row.primaryMarket === market) &&
        (department === "all" || row.department === department) &&
        // Email as well as name: two people can share a first name, and the
        // address is the thing an admin has been given in a message.
        (needle === "" ||
          row.name.toLowerCase().includes(needle) ||
          row.email.toLowerCase().includes(needle)),
    );
  }, [rows, market, department, query]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-surface p-6 text-center shadow-card">
        <span className="mx-auto grid size-10 place-items-center rounded-full bg-destructive/10">
          <ShieldAlert className="size-5 text-destructive" />
        </span>
        <h2 className="mt-4 text-base font-bold">Admins only</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          You do not have permission to view the admin overview.
        </p>
      </div>
    );
  }

  const submitted = filtered.filter((row) => row.status === "submitted").length;
  const draft = filtered.filter((row) => row.status === "draft").length;
  const missing = filtered.filter((row) => row.status === "missing").length;
  const completion = filtered.length ? Math.round((submitted / filtered.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* First, and outside the table, so it stays put while the table
            scrolls sideways on a narrow screen. */}
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search employee"
            aria-label="Search employees by name or email"
            className="h-9 w-[210px] rounded-md border bg-surface pr-2.5 pl-8 text-[13px] focus:outline-2 focus:outline-ring"
          />
        </div>
        <DateRangePicker value={range} onChange={setRange} />
        <Select value={market} onValueChange={setMarket}>
          <SelectTrigger className="h-9 w-[150px] text-[13px]">
            <SelectValue placeholder="Market" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All markets</SelectItem>
            {MARKETS.map((option) => (
              <SelectItem key={option} value={option}>
                {MARKET_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="h-9 w-[190px] text-[13px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* One row, in reading order: narrow the list, then act on it. The
            exports used to be pushed to the far right with ml-auto, which on
            any screen narrower than the whole lot dropped them onto a second
            line and left a gap where they had been. */}
        <ExportCsv from={from} to={to} market={market} department={department} />
        <ExportGrouped from={from} to={to} market={market} department={department} />
        <ExportByClient from={from} to={to} market={market} department={department} />
        <ExportTimeDedication />
        <ExportEmployeeDetail from={from} to={to} market={market} department={department} />
        <SyncDirectory />
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
        </p>
      )}

      {rows === null ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((cell) => (
              <Skeleton key={cell} className="h-[76px] w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric label="Employees" value={String(filtered.length)} hint="In current filter" />
            <Metric label="Submitted" value={String(submitted)} />
            <Metric label="Draft" value={String(draft)} />
            <Metric label="Missing" value={String(missing)} />
            <Metric
              label="Completion"
              value={`${completion}%`}
              hint={rangeLabel(range.from, range.to)}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-surface px-6 py-12 text-center">
              <h2 className="text-sm font-bold">No employees match these filters</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Everybody on the company employee list appears here, whether or not they have logged
                anything.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-surface shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b bg-surface-muted">
                      <th scope="col" className="label-xs px-3 py-2.5">
                        Employee
                      </th>
                      <th scope="col" className="label-xs px-3 py-2.5">
                        Market
                      </th>
                      <th scope="col" className="label-xs px-3 py-2.5">
                        Department
                      </th>
                      <th scope="col" className="label-xs px-3 py-2.5 text-right">
                        Hours
                      </th>
                      <th scope="col" className="label-xs px-3 py-2.5">
                        Status
                      </th>
                      <th scope="col" className="label-xs px-3 py-2.5">
                        Submitted
                      </th>
                      <th scope="col" className="label-xs px-3 py-2.5 text-right">
                        Export
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr
                        key={row.employeeId}
                        className="border-b last:border-b-0 hover:bg-surface-muted/60"
                      >
                        <td className="px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {row.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {row.primaryMarket ? MARKET_LABELS[row.primaryMarket] : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {row.department ?? "—"}
                        </td>
                        <td className="num px-3 py-2.5 text-right font-semibold">
                          {formatHours(row.totalHours)}
                          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                            / {formatHours(row.expectedHours)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="num px-3 py-2.5 text-muted-foreground">
                          {row.submittedAt
                            ? format(new Date(row.submittedAt), "d MMM · HH:mm")
                            : "—"}
                        </td>
                        {/* Everything this person has logged, not just the week
                            the table is showing. */}
                        <td className="px-3 py-2.5">
                          <EmployeeExportMenu employeeId={row.employeeId} name={row.name} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
