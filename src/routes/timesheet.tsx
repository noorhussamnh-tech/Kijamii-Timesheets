import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { endOfMonth, startOfMonth } from "date-fns";
import { AlertCircle } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Confetti } from "@/components/Confetti";
import { DailyNote } from "@/components/DailyNote";
import { MonthCoverage } from "@/components/MonthCoverage";
import { SaveIndicator } from "@/components/SaveIndicator";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitDialog } from "@/components/SubmitDialog";
import { SummaryBar } from "@/components/SummaryBar";
import { TimesheetGrid } from "@/components/TimesheetGrid";
import { WeekNav } from "@/components/WeekNav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { fetchMyLoggedDays } from "@/lib/data/api";
import { monthCoverage, type DayCoverage } from "@/lib/domain/coverage";
import { CATEGORICAL } from "@/lib/viz/palette";
import { dayLabel, toDateKey } from "@/lib/domain/week";
import { useTimesheet } from "@/lib/timesheet-store";

export const Route = createFileRoute("/timesheet")({
  head: () => ({
    meta: [
      { title: "My Timesheet — Kijamii Timesheets" },
      {
        name: "description",
        content: "Log weekly hours per client and service, then submit the week for review.",
      },
      { property: "og:title", content: "My Timesheet — Kijamii Timesheets" },
      {
        property: "og:description",
        content: "Weekly time entry for Kijamii teams with saved drafts and locked submissions.",
      },
    ],
  }),
  component: MyTimesheet,
});

function TimesheetPage() {
  const { rowIssues, weekIssues, showErrors, saveError, config, weekKey, addDay, visibleDates } =
    useTimesheet();
  const { status: authStatus } = useAuth();

  const [confirmOpen, setConfirmOpen] = useState(false);
  // Submitting is the moment somebody actually finishes something here, so it
  // is the moment worth marking. Unlike the milestones on My Time this is not
  // rationed: sending your week is an achievement every week.
  const [justSubmitted, setJustSubmitted] = useState(0);
  const navigate = useNavigate();

  // Fetched here rather than inside each component, so the note above and the
  // strip below are one request and can never disagree with each other.
  const [loggedDays, setLoggedDays] = useState<DayCoverage[] | null>(null);
  const month = new Date();

  useEffect(() => {
    if (authStatus !== "ready") return;
    let cancelled = false;

    void fetchMyLoggedDays(toDateKey(startOfMonth(month)), toDateKey(endOfMonth(month)))
      .then((rows) => {
        if (!cancelled) setLoggedDays(rows);
      })
      .catch(() => {
        // Neither the note nor the strip is worth taking the timesheet down for.
        if (!cancelled) setLoggedDays([]);
      });

    return () => {
      cancelled = true;
    };
    // Re-read when the week changes, so submitting a day updates both.
  }, [authStatus, weekKey]);

  const coverage = useMemo(
    () => (loggedDays ? monthCoverage(month, loggedDays, config.workDays) : null),
    [loggedDays, config.workDays],
  );

  const issueCount = rowIssues.length + weekIssues.length;

  /*
   * Bring a flagged row onto the screen before complaining about it.
   *
   * The grid shows today plus whatever has been revealed, so a row on another
   * day of the same week is validated but invisible. Being told that three
   * rows are incomplete, while one complete row is all that can be seen, is a
   * dead end -- the fix is somewhere the page never mentions.
   */
  useEffect(() => {
    if (!showErrors) return;
    for (const date of new Set(rowIssues.map((issue) => issue.date))) {
      if (!visibleDates.includes(date)) addDay(date);
    }
  }, [showErrors, rowIssues, visibleDates, addDay]);

  return (
    <>
      {justSubmitted > 0 && (
        <Confetti key={justSubmitted} fire palette={CATEGORICAL.map((slot) => slot.light)} />
      )}
      <div className="space-y-4 pb-2">
        <DailyNote coverage={coverage} />
        <WeekNav />
        <MonthCoverage coverage={coverage} />

        {saveError && (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {saveError}
          </p>
        )}

        {showErrors && issueCount > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-destructive">
              <AlertCircle className="size-4" />
              {issueCount} item{issueCount > 1 ? "s" : ""} need attention before submitting
            </p>
            <ul className="mt-1.5 space-y-1 pl-6 text-[12px] text-destructive/90">
              {weekIssues.map((issue) => (
                <li key={`${issue.code}-${issue.date ?? ""}`} className="list-disc">
                  {issue.message}
                </li>
              ))}
              {/* Named by day rather than numbered. "Row 2" counted problems,
                  not rows on the page, so it pointed at nothing. */}
              {rowIssues.slice(0, 5).map((issue) => (
                <li key={issue.entryId} className="list-disc">
                  <button
                    type="button"
                    onClick={() => addDay(issue.date)}
                    className="text-left underline underline-offset-2 hover:no-underline"
                  >
                    <span className="font-semibold">{dayLabel(issue.date)}</span> — {issue.message}
                  </button>
                </li>
              ))}
              {rowIssues.length > 5 && (
                <li className="list-disc">
                  and {rowIssues.length - 5} more row{rowIssues.length - 5 === 1 ? "" : "s"}.
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="ml-auto text-[11px] text-muted-foreground">
            <span className="text-brand">*</span> Required · Hours in 0.25 steps · Up to 16h per day
          </span>
        </div>

        <TimesheetGrid />
      </div>

      <SummaryBar onSubmit={() => setConfirmOpen(true)} />
      <SubmitDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirmed={(outcome) => {
          // Leaving for the confirmation page is only right when there is
          // nothing left to do here. With rows still waiting, walking the
          // person away from the timesheet is the last thing that helps --
          // they stay, the burst still fires for what they did send, and the
          // waiting rows are outlined behind it.
          if (outcome.held === 0) {
            void navigate({ to: "/submitted" });
            return;
          }
          if (outcome.filed > 0) setJustSubmitted((n) => n + 1);
        }}
      />
    </>
  );
}

function MyTimesheet() {
  return (
    <AppShell
      title="My Timesheet"
      actions={
        <div className="hidden items-center gap-2 sm:flex">
          <TimesheetStatus />
        </div>
      }
    >
      <TimesheetPage />
    </AppShell>
  );
}

function TimesheetStatus() {
  const { status } = useTimesheet();
  return (
    <>
      <StatusBadge status={status} />
      <SaveIndicator />
    </>
  );
}
