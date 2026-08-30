import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Eye } from "lucide-react";
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
import { weekDays, weekNumberLabel, weekRangeLabel, type SubmissionStatus } from "@/data/weeks";
import { useTimesheet } from "@/lib/timesheet-store";

export const Route = createFileRoute("/submissions")({
  head: () => ({
    meta: [
      { title: "Previous Submissions — Kijamii Timesheets" },
      {
        name: "description",
        content: "History of submitted weekly timesheets with hours, status and submission dates.",
      },
      { property: "og:title", content: "Previous Submissions — Kijamii Timesheets" },
      {
        property: "og:description",
        content: "Filter past Kijamii timesheet weeks by year and status, and open any week read-only.",
      },
    ],
  }),
  component: Submissions,
});

const statuses: (SubmissionStatus | "all")[] = ["all", "draft", "submitted"];

function Submissions() {
  const { submissions, entriesFor, setWeekKey } = useTimesheet();
  const navigate = useNavigate();
  const [month, setMonth] = useState("all");
  const [status, setStatus] = useState<string>("all");

  const rows = useMemo(() => {
    const num = (v: number | "") => (typeof v === "number" ? v : 0);
    return Object.values(submissions)
      .map((s) => {
        const entries = entriesFor(s.weekKey);
        const total = entries.reduce((a, r) => a + num(r.hours), 0);
        return {
          ...s,
          total,
          billable: entries.filter((r) => r.billable).reduce((a, r) => a + num(r.hours), 0),
          month: format(weekDays(s.weekKey)[0]!, "yyyy-MM"),
          monthLabel: format(weekDays(s.weekKey)[0]!, "MMMM yyyy"),
        };
      })
      .filter(
        (r) => (month === "all" || r.month === month) && (status === "all" || r.status === status),
      )
      .sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1));
  }, [submissions, entriesFor, month, status]);

  const months = [
    ...new Map(
      Object.keys(submissions)
        .map((k) => weekDays(k)[0]!)
        .sort((a, b) => b.getTime() - a.getTime())
        .map((d) => [format(d, "yyyy-MM"), format(d, "MMMM yyyy")] as const),
    ).entries(),
  ];

  const open = (weekKey: string) => {
    setWeekKey(weekKey);
    void navigate({ to: "/timesheet" });
  };

  return (
    <AppShell title="Previous Submissions" description="Your weekly timesheet history">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-9 w-[170px] text-[13px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {months.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[160px] text-[13px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All statuses" : s[0]!.toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-[12px] text-muted-foreground">
            {rows.length} week{rows.length === 1 ? "" : "s"}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-surface px-6 py-12 text-center">
            <p className="text-sm font-semibold">No weeks match these filters</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Clear the filters, or start this week's timesheet.
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => {
                setMonth("all");
                setStatus("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-lg border bg-surface shadow-card md:block">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b bg-surface-muted">
                    <th className="label-xs px-3 py-2.5">Week</th>
                    <th className="label-xs px-3 py-2.5">Date range</th>
                    <th className="label-xs px-3 py-2.5 text-right">Total</th>
                    <th className="label-xs px-3 py-2.5 text-right">Billable</th>
                    <th className="label-xs px-3 py-2.5">Status</th>
                    <th className="label-xs px-3 py-2.5">Submitted</th>
                    <th className="label-xs px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.weekKey} className="border-b last:border-b-0 hover:bg-surface-muted/60">
                      <td className="num px-3 py-2.5 font-semibold">{weekNumberLabel(r.weekKey)}</td>
                      <td className="num px-3 py-2.5 text-muted-foreground">
                        {weekRangeLabel(r.weekKey)}
                      </td>
                      <td className="num px-3 py-2.5 text-right font-semibold">{r.total}h</td>
                      <td className="num px-3 py-2.5 text-right">{r.billable}h</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="num px-3 py-2.5 text-muted-foreground">
                        {r.submittedAt ? format(new Date(r.submittedAt), "d MMM · HH:mm") : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => open(r.weekKey)}>
                          <Eye className="size-3.5" /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 md:hidden">
              {rows.map((r) => (
                <article key={r.weekKey} className="rounded-lg border bg-surface p-3 shadow-card">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="num truncate text-[13px] font-semibold">
                        {weekNumberLabel(r.weekKey)}
                      </p>
                      <p className="num truncate text-[12px] text-muted-foreground">
                        {weekRangeLabel(r.weekKey)}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 border-t pt-2.5">
                    <div>
                      <p className="label-xs">Total</p>
                      <p className="num text-[13px] font-semibold">{r.total}h</p>
                    </div>
                    <div>
                      <p className="label-xs">Billable</p>
                      <p className="num text-[13px] font-semibold">{r.billable}h</p>
                    </div>
                    <div>
                      <p className="label-xs">Submitted</p>
                      <p className="num text-[13px]">
                        {r.submittedAt ? format(new Date(r.submittedAt), "d MMM") : "—"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2.5 w-full"
                    onClick={() => open(r.weekKey)}
                  >
                    <Eye className="size-3.5" /> View week
                  </Button>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
