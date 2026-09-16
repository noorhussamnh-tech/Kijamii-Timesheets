import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Confetti } from "@/components/Confetti";
import { Button } from "@/components/ui/button";
import { formatHours } from "@/lib/domain/totals";
import { weekRangeLabel } from "@/lib/domain/week";
import { useTimesheet } from "@/lib/timesheet-store";
import { CATEGORICAL } from "@/lib/viz/palette";

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
  component: SubmittedRoute,
});

function SubmittedRoute() {
  return (
    <AppShell title="Submission Confirmation" description="Hours logged">
      <Submitted />
    </AppShell>
  );
}

function Submitted() {
  const { lastSubmission, weekKey, totals } = useTimesheet();

  /*
   * The burst belongs here, on the page a submission actually lands on.
   *
   * It used to be fired on the timesheet, by the same handler that navigates
   * away -- and on the one path worth celebrating, everything filed and
   * nothing held back, that handler navigated and returned before reaching
   * the line that set it off. So the only submission that ever produced
   * confetti was a partial one, which is the least celebratory outcome there
   * is. Rendering it here fires once per arrival, which is once per
   * submission.
   */

  // Landing here directly (a refresh, a bookmark) still shows something
  // truthful rather than a fabricated confirmation.
  if (!lastSubmission) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border bg-surface p-6 text-center shadow-card">
        <h2 className="text-base font-bold">Nothing submitted in this session</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Open Previous Submissions to see your timesheet history.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild size="sm">
            <Link to="/submissions">View submissions</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/timesheet">Back to timesheet</Link>
          </Button>
        </div>
      </div>
    );
  }

  const week = lastSubmission.weekStart ?? weekKey;
  const hours = lastSubmission.totalHours ?? totals.total;

  return (
    <>
      {/* Not for "this week was already submitted": nothing was filed, and a
          burst for a no-op is how the effect stops meaning anything. */}
      {!lastSubmission.alreadySubmitted && (
        <Confetti fire palette={CATEGORICAL.map((slot) => slot.light)} />
      )}
      <div className="mx-auto max-w-lg rounded-xl border bg-surface p-6 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft">
            <CheckCircle2 className="size-5 text-success" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">
              {lastSubmission.alreadySubmitted
                ? "This week was already submitted."
                : "Timesheet submitted successfully."}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              Your hours are filed. You can still correct them if something changes.
            </p>
          </div>
        </div>

        <dl className="mt-5 divide-y rounded-lg border text-[13px]">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-muted-foreground">Week submitted</dt>
            <dd className="num text-right font-semibold">{weekRangeLabel(week)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-muted-foreground">Total hours</dt>
            <dd className="num font-semibold">{formatHours(hours)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-muted-foreground">Submitted at</dt>
            <dd className="num text-right font-semibold">
              {lastSubmission.submittedAt
                ? format(new Date(lastSubmission.submittedAt), "d MMM yyyy · HH:mm")
                : "—"}
            </dd>
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
    </>
  );
}
