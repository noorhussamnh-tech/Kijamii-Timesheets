import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { AlertCircle, Search, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DateRangePicker, rangeLabel } from "@/components/DateRangePicker";
import { EmployeeExportMenu } from "@/components/EmployeeExportMenu";
import { ExportByClient } from "@/components/ExportByClient";
import { ExportCsv } from "@/components/ExportCsv";
import { ExportGrouped } from "@/components/ExportGrouped";
import { Metric } from "@/components/Metric";
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
import { fetchRangeOverview } from "@/lib/data/api";
import { formatHours } from "@/lib/domain/totals";
import { type AdminEmployeeStatus } from "@/lib/domain/types";
import { currentWeekKey, parseDateKey, toDateKey, weekEnd } from "@/lib/domain/week";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "My Team — Kijamii Timesheets" },
      {
        name: "description",
        content: "What the people who report to you have logged, for any period.",
      },
      { property: "og:title", content: "My Team — Kijamii Timesheets" },
      {
        property: "og:description",
        content: "Completion, hours and exports for your own team.",
      },
    ],
  }),
  component: TeamRoute,
});

function TeamRoute() {
  return (
    <AppShell title="My Team" description="What your people have logged, for any period">
      <TeamOverview />
    </AppShell>
  );
}

/**
 * The admin overview, narrowed to the people who report to you.
 *
 * Team leads asked for it, and the shape of the answer is the shape the admin
 * page already has -- so it is the same table, the same metrics and the same
 * export buttons rather than a second dialect of the same figures. Nothing
 * here decides who is in it: every call goes to the same database function
 * the admin page calls, which returns the company to an admin and the
 * reporting line to everybody else. A manager cannot widen it by editing a
 * filter, and the two pages cannot drift apart.
 *
 * "Your people" is everybody underneath, not only the direct reports. A
 * director who asks what their department is working on means the department.
 *
 * Deliberately read-only: no reopening a week, no editing somebody's row, no
 * sync. Those are the admin's, and a manager who needs one asks for it --
 * which is a conversation the company already knows how to have.
 */
function TeamOverview() {
  const { teamScope, status: authStatus } = useAuth();

  const [range, setRange] = useState(() => {
    const key = currentWeekKey();
    return { from: parseDateKey(key), to: parseDateKey(weekEnd(key)) };
  });
  const from = toDateKey(range.from);
  const to = toDateKey(range.to);

  const [rows, setRows] = useState<AdminEmployeeStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("all");

  const manages = (teamScope?.reports ?? 0) > 0;

  useEffect(() => {
    // The fetch is refused by the database for anybody who manages nobody;
    // this only avoids making a call whose answer is already known.
    if (authStatus !== "ready" || !manages) return;
    let cancelled = false;

    setRows(null);
    setError(null);

    void fetchRangeOverview(from, to, "team")
      .then((data: AdminEmployeeStatus[]) => {
        if (!cancelled) setRows(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setRows([]);
          setError(cause instanceof Error ? cause.message : "Could not load your team.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [from, to, manages, authStatus]);

  /*
   * One filter, not four. An admin needs to cut a company; a manager is
   * already looking at a short list, and the only cut that earns its place is
   * the account team -- because somebody with people on two of them asks
   * about one at a time.
   */
  const teams = useMemo(
    () => [...new Set((rows ?? []).flatMap((row) => row.teams))].sort(),
    [rows],
  );

  useEffect(() => {
    if (team !== "all" && rows !== null && !teams.includes(team)) setTeam("all");
  }, [teams, team, rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (row) =>
        (team === "all" || row.teams.includes(team)) &&
        (needle === "" ||
          row.name.toLowerCase().includes(needle) ||
          row.email.toLowerCase().includes(needle)),
    );
  }, [rows, team, query]);

  if (teamScope === null && authStatus === "ready") {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!manages) {
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-surface p-6 text-center shadow-card">
        <span className="mx-auto grid size-10 place-items-center rounded-full bg-muted">
          <Users className="size-5 text-muted-foreground" />
        </span>
        <h2 className="mt-4 text-base font-bold">Nobody reports to you</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          This page shows the timesheets of the people the company employee list puts under you. If
          you manage somebody and they are not here, the Manager column on their row in the list is
          what decides it.
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
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your team"
            aria-label="Search your team by name or email"
            className="h-9 w-[210px] rounded-md border bg-surface pr-2.5 pl-8 text-[13px] focus:outline-2 focus:outline-ring"
          />
        </div>
        <DateRangePicker value={range} onChange={setRange} />
        <Select value={team} onValueChange={setTeam}>
          <SelectTrigger className="h-9 w-[180px] text-[13px]">
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            {teams.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ExportCsv from={from} to={to} department="all" manager="all" team={team} scope="team" />
      </div>

      {/* The same files the admin page produces, over the same rows -- which
          for this caller are their team's and nobody else's. */}
      <div className="flex flex-wrap items-center gap-2">
        <ExportGrouped
          from={from}
          to={to}
          department="all"
          manager="all"
          team={team}
          dedication={false}
          scope="team"
        />
        <ExportByClient from={from} to={to} department="all" scope="team" />
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
            <Metric label="Your team" value={String(filtered.length)} hint="In current filter" />
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
              <h2 className="text-sm font-bold">Nobody on your team matches this filter</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Everybody under you who is asked for a timesheet appears here, whether or not they
                have logged anything.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-surface shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b bg-surface-muted">
                      <th scope="col" className="label-xs px-3 py-2.5">
                        Employee
                      </th>
                      <th scope="col" className="label-xs px-3 py-2.5">
                        Team
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
                          {row.teams.length > 0 ? row.teams.join(", ") : "—"}
                        </td>
                        <td className="num px-3 py-2.5 text-right font-semibold">
                          {formatHours(row.totalHours)}
                          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                            / {formatHours(row.expectedHours)}
                          </span>
                          {/* Filed hours are the headline, so this column ties
                              to every export. Anything still in draft is said
                              separately rather than added in. */}
                          {row.draftHours > 0 && (
                            <span className="block text-[11px] font-normal text-warning">
                              +{formatHours(row.draftHours)} draft
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="num px-3 py-2.5 text-muted-foreground">
                          {row.submittedAt
                            ? format(new Date(row.submittedAt), "d MMM · HH:mm")
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <EmployeeExportMenu
                            employeeId={row.employeeId}
                            name={row.name}
                            scope="team"
                          />
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
