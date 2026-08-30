import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, CopyPlus, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitDialog } from "@/components/SubmitDialog";
import { SummaryBar } from "@/components/SummaryBar";
import { TimesheetGrid } from "@/components/TimesheetGrid";
import { WeekNav } from "@/components/WeekNav";
import { Button } from "@/components/ui/button";

import { getVertical } from "@/data/reference";
import { useTimesheet } from "@/lib/timesheet-store";

export const Route = createFileRoute("/timesheet")({
  head: () => ({
    meta: [
      { title: "My Timesheet — Kijamii Timesheets" },
      {
        name: "description",
        content: "Log weekly hours per client, job and service, then submit the week for review.",
      },
      { property: "og:title", content: "My Timesheet — Kijamii Timesheets" },
      {
        property: "og:description",
        content: "Weekly time entry for Kijamii teams with autosaved drafts and locked submissions.",
      },
    ],
  }),
  component: MyTimesheet,
});

function MyTimesheet() {
  const {
    employee,
    marketId,
    config,
    status,
    lastSavedAt,
    dirty,
    issues,
    showErrors,
    setShowErrors,
    copyPreviousDay,
    clearUnsaved,
    readOnly,
    entries,
  } = useTimesheet();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitDate, setSubmitDate] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmitWeek = () => {
    if (issues.length) {
      setShowErrors(true);
      return;
    }
    setSubmitDate(null);
    setConfirmOpen(true);
  };

  const handleSubmitDay = (date: string) => {
    const dayRowIds = new Set(entries.filter((r) => r.date === date).map((r) => r.id));
    if (issues.some((i) => dayRowIds.has(i.rowId))) {
      setShowErrors(true);
      return;
    }
    setSubmitDate(date);
    setConfirmOpen(true);
  };

  return (
    <AppShell
      title="My Timesheet"
      actions={
        <div className="hidden items-center gap-2 sm:flex">
          <StatusBadge status={status} />
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {dirty ? (
              <>
                <RotateCcw className="size-3 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3 text-success" /> Saved{" "}
                {lastSavedAt ? format(new Date(lastSavedAt), "HH:mm") : "just now"}
              </>
            )}
          </span>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <WeekNav />

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-surface-muted px-3 py-2 text-[12px] text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-success" />
          <span>
            You fill in <span className="font-semibold text-foreground">Date</span>,{" "}
            <span className="font-semibold text-foreground">Client name</span>,{" "}
            <span className="font-semibold text-foreground">Service</span>,{" "}
            <span className="font-semibold text-foreground">Project Type</span>,{" "}
            <span className="font-semibold text-foreground">Task / Description</span> and{" "}
            <span className="font-semibold text-foreground">Hours</span>.{" "}
            <span className="font-semibold text-foreground">Project</span> is optional.
          </span>
          <span className="hidden sm:inline">·</span>
          <span>
            Clients are filtered by your vertical (
            <span className="font-semibold text-foreground">{getVertical(marketId).name}</span>),
            which is stored with every row alongside your email{" "}
            <span className="font-semibold text-foreground">{employee.email}</span>.
          </span>
        </div>


        {showErrors && issues.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-destructive">
              <AlertCircle className="size-4" /> {issues.length} row
              {issues.length > 1 ? "s" : ""} need attention before submitting
            </p>
            <ul className="mt-1.5 space-y-1 pl-6 text-[12px] text-destructive/90">
              {issues.slice(0, 5).map((i, idx) => (
                <li key={i.rowId} className="list-disc">
                  Row {idx + 1}: {i.message}
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
            <Button variant="ghost" size="sm" onClick={clearUnsaved} disabled={!dirty}>
              Clear unsaved changes
            </Button>
            <span className="ml-auto text-[11px] text-muted-foreground">
              <span className="text-brand">*</span> Required · Hours in 0.25 steps · Max 24h per day
            </span>
          </div>
        )}

        <TimesheetGrid />
      </div>

      <SummaryBar onSubmitDay={handleSubmitDay} onSubmitWeek={handleSubmitWeek} />
      <SubmitDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        date={submitDate}
        onConfirmed={() => void navigate({ to: "/submitted" })}
      />
    </AppShell>
  );
}
