import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { weekRangeLabel } from "@/data/weeks";
import { useTimesheet } from "@/lib/timesheet-store";

export const Route = createFileRoute("/submitted")({
  head: () => ({
    meta: [
      { title: "Timesheet submitted — Kijamii Timesheets" },
      {
        name: "description",
        content: "Confirmation that your weekly Kijamii timesheet was submitted for review.",
      },
      { property: "og:title", content: "Timesheet submitted — Kijamii Timesheets" },
      {
        property: "og:description",
        content: "Week submitted, total hours and submission timestamp.",
      },
    ],
  }),
  component: Submitted,
});

function Submitted() {
  const { lastSubmission, weekKey, totals } = useTimesheet();
  const week = lastSubmission?.weekKey ?? weekKey;
  const hours = lastSubmission?.hours ?? totals.total;
  const at = lastSubmission?.at ?? new Date().toISOString();

  return (
    <AppShell title="Submission Confirmation" description="Hours logged">
      <div className="mx-auto max-w-lg rounded-xl border bg-surface p-6 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft">
            <CheckCircle2 className="size-5 text-success" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">Timesheet submitted successfully.</h2>
            <p className="text-[13px] text-muted-foreground">
              Your hours are logged and locked.
            </p>
          </div>
        </div>

        <dl className="mt-5 divide-y rounded-lg border text-[13px]">
          <div className="flex items-center justify-between px-3 py-2.5">
            <dt className="text-muted-foreground">Week submitted</dt>
            <dd className="num font-semibold">{weekRangeLabel(week)}</dd>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5">
            <dt className="text-muted-foreground">Total hours</dt>
            <dd className="num font-semibold">{hours}h</dd>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5">
            <dt className="text-muted-foreground">Submitted at</dt>
            <dd className="num font-semibold">{format(new Date(at), "d MMM yyyy · HH:mm")}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/submissions">View submission</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/timesheet">Return to timesheet</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
