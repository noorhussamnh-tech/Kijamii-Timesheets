import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { AlertCircle, ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ExportCsv } from "@/components/ExportCsv";
import { ExportEmployeeDetail } from "@/components/ExportEmployeeDetail";
import { SyncTitles } from "@/components/SyncTitles";
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
import { fetchAdminWeek } from "@/lib/data/api";
import { formatHours } from "@/lib/domain/totals";
import { MARKETS, MARKET_LABELS, type AdminEmployeeStatus, type Market } from "@/lib/domain/types";
import { currentWeekKey, shiftWeek, weekRangeLabel } from "@/lib/domain/week";

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
        content: "Completion rate, submitted, draft and missing timesheets for a week.",
      },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <AppShell title="Admin Overview" description="Weekly submission status">
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

  const [week, setWeek] = useState(() => currentWeekKey());
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

    void fetchAdminWeek(week)
      .then((data) => {
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
  }, [week, isAdmin, authStatus]);

  const departments = useMemo(() => {
    const set = new Set((rows ?? []).map((row) => row.department).filter(Boolean));
    return [...set] as string[];
  }, [rows]);

  const filtered = useMemo(
    () =>
      (rows ?? []).filter(
        (row) =>
          (market === "all" || row.markets.includes(market as Market)) &&
          (department === "all" || row.department === department),
      ),
    [rows, market, department],
  );

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

  const weekOptions = [0, -1, -2, -3, -4].map((offset) => shiftWeek(currentWeekKey(), offset));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={week} onValueChange={setWeek}>
          <SelectTrigger className="h-9 w-[210px] text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {weekOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {weekRangeLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ExportCsv weekStart={week} market={market} department={department} />
          <ExportTimeDedication />
          <ExportEmployeeDetail market={market} department={department} />
          <SyncTitles />
        </div>
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
            <Metric label="Completion" value={`${completion}%`} hint={weekRangeLabel(week)} />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-surface px-6 py-12 text-center">
              <h2 className="text-sm font-bold">No employees match these filters</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Only people who have completed onboarding appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-surface shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-[13px]">
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
                          {row.markets.map((m) => MARKET_LABELS[m]).join(", ") || "—"}
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
