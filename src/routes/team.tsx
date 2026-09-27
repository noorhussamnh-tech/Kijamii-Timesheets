import { Fragment, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Search, Users } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { DateRangePicker, rangeLabel } from "@/components/DateRangePicker";
import { ExportByClient } from "@/components/ExportByClient";
import { ExportCsv } from "@/components/ExportCsv";
import { ExportGrouped } from "@/components/ExportGrouped";
import { Metric } from "@/components/Metric";
import { StatusBadge, statusTextClass } from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { fetchExportRows, fetchRangeOverview, type ExportRow } from "@/lib/data/api";
import { formatHours } from "@/lib/domain/totals";
import { type AdminEmployeeStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { currentWeekKey, parseDateKey, shortDayLabel, toDateKey, weekEnd } from "@/lib/domain/week";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "My Team — Kijamii Timesheets" },
      {
        name: "description",
        content: "What the people who report to you have logged, for any period.",
      },
      { property: "og:title", content: "My Team — Kijamii Timesheets" },
      { property: "og:description", content: "Your team's entries, and the files that fold them." },
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

/** The columns, in the order My Timesheet has them. */
const COLUMNS = ["Date", "Client name", "Project type", "Work type", "Hours", "Notes"] as const;

function workTypeLabel(row: ExportRow): string {
  return row.workType === "amend" ? "Amend" : row.workType === "new_task" ? "New Task" : "—";
}

/**
 * Your own team's timesheet.
 *
 * Built to read as My Timesheet does rather than as a management console,
 * because that is the page everybody here already knows how to read: the same
 * columns in the same order, grouped under a heading, the hours on the right.
 * What changes is the grouping -- a person's own sheet groups by day, and a
 * team's groups by person, because the question a lead opens this to ask is
 * "what is Amina working on", not "what happened on Tuesday".
 *
 * Exports sit at the top rather than the bottom. Somebody who came here to
 * take the file away should not have to scroll a team's month of work to find
 * the button that gives it to them.
 *
 * Submitted rows only, which is the same cut every export makes. Anything
 * still in draft is counted in the heading and left out of the rows: a
 * half-typed line is not work somebody should be asked about.
 *
 * Nothing here decides who is in it. Every call goes to a database function
 * that returns the caller's own reporting line and refuses anybody else, so a
 * filter cannot widen it and this page and the admin page cannot disagree
 * about a number.
 *
 * Deliberately read-only: no reopening a week, no editing somebody's row, no
 * directory sync. Those belong to an admin, and a manager who needs one asks
 * -- which is a conversation the company already knows how to have.
 */
function TeamOverview() {
  const { teamScope, status: authStatus } = useAuth();

  const [range, setRange] = useState(() => {
    const key = currentWeekKey();
    return { from: parseDateKey(key), to: parseDateKey(weekEnd(key)) };
  });
  const from = toDateKey(range.from);
  const to = toDateKey(range.to);

  const [people, setPeople] = useState<AdminEmployeeStatus[] | null>(null);
  const [entries, setEntries] = useState<ExportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("all");

  const manages = (teamScope?.reports ?? 0) > 0;

  useEffect(() => {
    // The fetches are refused by the database for anybody who manages nobody;
    // this only avoids making calls whose answer is already known.
    if (authStatus !== "ready" || !manages) return;
    let cancelled = false;

    setPeople(null);
    setEntries([]);
    setError(null);

    /*
     * Both at once, and neither is shown until both land. The roster carries
     * the status and the expected hours, the entries carry the work; a page
     * that painted one and then the other would show every person as having
     * logged nothing for as long as the second call took.
     */
    void Promise.all([fetchRangeOverview(from, to, "team"), fetchExportRows(from, to, "team")])
      .then(([roster, rows]) => {
        if (cancelled) return;
        setPeople(roster);
        setEntries(rows);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setPeople([]);
        setError(cause instanceof Error ? cause.message : "Could not load your team.");
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
    () => [...new Set((people ?? []).flatMap((person) => person.teams))].sort(),
    [people],
  );

  useEffect(() => {
    if (team !== "all" && people !== null && !teams.includes(team)) setTeam("all");
  }, [teams, team, people]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (people ?? []).filter(
      (person) =>
        (team === "all" || person.teams.includes(team)) &&
        (needle === "" ||
          person.name.toLowerCase().includes(needle) ||
          person.email.toLowerCase().includes(needle)),
    );
  }, [people, team, query]);

  /*
   * Rows against the person who logged them, matched on the address rather
   * than the name: two people can share a first name, and the employee list
   * spells the same person's name more than one way.
   */
  const byEmail = useMemo(() => {
    const map = new Map<string, ExportRow[]>();
    for (const row of entries) {
      const key = row.employeeEmail.toLowerCase();
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    for (const list of map.values()) list.sort((a, b) => a.workDate.localeCompare(b.workDate));
    return map;
  }, [entries]);

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

  const submitted = filtered.filter((person) => person.status === "submitted").length;
  const draft = filtered.filter((person) => person.status === "draft").length;
  const missing = filtered.filter((person) => person.status === "missing").length;
  const completion = filtered.length ? Math.round((submitted / filtered.length) * 100) : 0;
  const loading = people === null;

  return (
    <div className="space-y-4">
      {/* First, because taking the file away is what most people open this
          page to do, and the alternative is scrolling a team's month of work
          to find the button. */}
      <div className="flex flex-wrap items-center gap-2">
        <ExportCsv from={from} to={to} department="all" manager="all" team={team} scope="team" />
        <ExportGrouped
          from={from}
          to={to}
          department="all"
          manager="all"
          team={team}
          dedication={false}
          people={false}
          scope="team"
        />
        <ExportByClient from={from} to={to} department="all" scope="team" />
      </div>

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
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((cell) => (
              <Skeleton key={cell} className="h-[76px] w-full" />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
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
                <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
                  <caption className="sr-only">
                    Submitted entries for {rangeLabel(range.from, range.to)}, grouped by person.
                  </caption>
                  <thead>
                    <tr className="border-b bg-surface-muted">
                      {COLUMNS.map((column) => (
                        <th
                          key={column}
                          scope="col"
                          className={`label-xs px-2.5 py-3 ${column === "Hours" ? "text-right" : ""}`}
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((person) => {
                      const rows = byEmail.get(person.email.toLowerCase()) ?? [];
                      return (
                        <Fragment key={person.employeeId}>
                          <tr className="border-b bg-background/70">
                            <th
                              scope="colgroup"
                              colSpan={COLUMNS.length}
                              className="px-2.5 py-2.5 text-left font-semibold"
                            >
                              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <span
                                  className={cn(
                                    "text-[15px] font-bold",
                                    statusTextClass(person.status),
                                  )}
                                >
                                  {person.name}
                                </span>
                                <span className="text-[11px] font-normal text-muted-foreground">
                                  {person.email}
                                </span>
                                <StatusBadge status={person.status} />
                                <span className="num ml-auto text-[13px] font-semibold">
                                  {formatHours(person.totalHours)}
                                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                                    / {formatHours(person.expectedHours)}
                                  </span>
                                </span>
                                {/* Filed hours are the headline, so the figure
                                    above ties to every export. Anything still
                                    in draft is said separately rather than
                                    added in, and its rows are not listed. */}
                                {person.draftHours > 0 && (
                                  <span className="text-[11px] font-medium text-warning">
                                    +{formatHours(person.draftHours)} in draft
                                  </span>
                                )}
                              </span>
                            </th>
                          </tr>

                          {rows.length === 0 ? (
                            <tr className="border-b last:border-b-0">
                              <td
                                colSpan={COLUMNS.length}
                                className="px-2.5 py-3 text-[12px] text-muted-foreground"
                              >
                                Nothing submitted in this period.
                              </td>
                            </tr>
                          ) : (
                            rows.map((row) => (
                              <tr
                                key={row.entryId}
                                className="border-b align-middle last:border-b-0 hover:bg-surface-muted/60"
                              >
                                <td className="num px-2.5 py-2 whitespace-nowrap">
                                  {shortDayLabel(row.workDate)}
                                </td>
                                <td className="px-2.5 py-2">{row.clientName ?? "—"}</td>
                                <td className="px-2.5 py-2 text-muted-foreground">
                                  {row.projectType ?? "—"}
                                </td>
                                <td className="px-2.5 py-2 text-muted-foreground">
                                  {workTypeLabel(row)}
                                </td>
                                <td className="num px-2.5 py-2 text-right font-semibold">
                                  {formatHours(Number(row.hours))}
                                </td>
                                <td className="max-w-[280px] truncate px-2.5 py-2 text-muted-foreground">
                                  {row.notes ?? ""}
                                </td>
                              </tr>
                            ))
                          )}
                        </Fragment>
                      );
                    })}
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
