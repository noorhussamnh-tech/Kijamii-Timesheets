import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, CopyPlus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { SaveIndicator } from "@/components/SaveIndicator";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitDialog } from "@/components/SubmitDialog";
import { SummaryBar } from "@/components/SummaryBar";
import { TimesheetGrid } from "@/components/TimesheetGrid";
import { WeekNav } from "@/components/WeekNav";
import { Button } from "@/components/ui/button";
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
  const { rowIssues, weekIssues, showErrors, copyPreviousDay, readOnly, saveError, isFuture } =
    useTimesheet();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitDate, setSubmitDate] = useState<string | null>(null);
  const navigate = useNavigate();

  const openConfirm = (date: string | null) => {
    setSubmitDate(date);
    setConfirmOpen(true);
  };

  const issueCount = rowIssues.length + weekIssues.length;

  return (
    <>
      <div className="space-y-4 pb-2">
        <WeekNav />

        {isFuture && (
          <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-[12px] font-medium text-warning">
            This week has not started yet, so it cannot be filled in.
          </p>
        )}

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
              {rowIssues.slice(0, 5).map((issue, index) => (
                <li key={issue.entryId} className="list-disc">
                  Row {index + 1}: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyPreviousDay}>
              <CopyPlus className="size-3.5" /> Copy entries from previous day
            </Button>
            <span className="ml-auto text-[11px] text-muted-foreground">
              <span className="text-brand">*</span> Required · Hours in 0.25 steps · Max 24h per day
            </span>
          </div>
        )}

        <TimesheetGrid />
      </div>

      <SummaryBar
        onSubmitDay={(date) => openConfirm(date)}
        onSubmitWeek={() => openConfirm(null)}
      />
      <SubmitDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        date={submitDate}
        onConfirmed={() => {
          if (!submitDate) void navigate({ to: "/submitted" });
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
