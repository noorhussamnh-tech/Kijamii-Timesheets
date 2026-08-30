import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminRoster } from "@/data/sample";
import { departments, verticals } from "@/data/reference";
import { weekRangeLabel, shiftWeekKey } from "@/data/weeks";
import { useTimesheet } from "@/lib/timesheet-store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Overview — Kijamii Timesheets" },
      {
        name: "description",
        content: "Weekly submission status across Kijamii verticals and departments.",
      },
      { property: "og:title", content: "Admin Overview — Kijamii Timesheets" },
      {
        property: "og:description",
        content: "Completion rate, submitted, draft and missing timesheets for the selected week.",
      },
    ],
  }),
  component: AdminOverview,
});

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-surface p-3 shadow-card">
      <p className="label-xs">{label}</p>
      <p className="num mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AdminOverview() {
  const { weekKey } = useTimesheet();
  const [week, setWeek] = useState(weekKey);
  const [market, setMarket] = useState("all");
  const [dept, setDept] = useState("all");

  const rows = useMemo(
    () =>
      adminRoster.filter(
        (r) =>
          (market === "all" || r.marketId === market) && (dept === "all" || r.departmentId === dept),
      ),
    [market, dept],
  );

  const submitted = rows.filter((r) => r.status === "submitted").length;
  const draft = rows.filter((r) => r.status === "draft").length;
  const missing = rows.filter((r) => r.status === "missing").length;
  const completion = rows.length ? Math.round((submitted / rows.length) * 100) : 0;

  const weekOptions = [0, -1, -2, -3].map((o) => shiftWeekKey(weekKey, o));

  return (
    <AppShell title="Admin Overview" description="Operational visibility mockup">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={week} onValueChange={setWeek}>
            <SelectTrigger className="h-9 w-[210px] text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weekOptions.map((w) => (
                <SelectItem key={w} value={w}>
                  {weekRangeLabel(w)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={market} onValueChange={setMarket}>
            <SelectTrigger className="h-9 w-[150px] text-[13px]">
              <SelectValue placeholder="Vertical" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All verticals</SelectItem>
              {verticals.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="h-9 w-[190px] text-[13px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="Employees" value={String(rows.length)} hint="In current filter" />
          <Metric label="Submitted" value={String(submitted)} />
          <Metric label="Draft" value={String(draft)} />
          <Metric label="Missing" value={String(missing)} />
          <Metric label="Completion" value={`${completion}%`} hint={weekRangeLabel(week)} />
        </div>

        <div className="overflow-hidden rounded-lg border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-[13px]">
              <thead>
                <tr className="border-b bg-surface-muted">
                  <th className="label-xs px-3 py-2.5">Employee</th>
                  <th className="label-xs px-3 py-2.5">Vertical</th>
                  <th className="label-xs px-3 py-2.5">Department</th>
                  <th className="label-xs px-3 py-2.5 text-right">Hours</th>
                  <th className="label-xs px-3 py-2.5">Status</th>
                  <th className="label-xs px-3 py-2.5">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 hover:bg-surface-muted/60">
                    <td className="px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold">
                          {r.initials}
                        </span>
                        <span className="truncate font-medium">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {verticals.find((m) => m.id === r.marketId)?.name}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {departments.find((d) => d.id === r.departmentId)?.name}
                    </td>
                    <td className="num px-3 py-2.5 text-right font-semibold">{r.hours}h</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="num px-3 py-2.5 text-muted-foreground">
                      {r.submittedAt ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
