import { useState } from "react";
import { Loader2, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { formatHours } from "@/lib/domain/totals";
import { MARKET_LABELS } from "@/lib/domain/types";
import { isBlankRow, missingFields } from "@/lib/domain/validation";
import { dayLabel, weekRangeLabel } from "@/lib/domain/week";
import { useTimesheet, type SubmitOutcome } from "@/lib/timesheet-store";

/**
 * One Submit, and it always does something.
 *
 * There is no per-day variant: choosing between "this day" and "this week"
 * was a decision the person had no reason to care about, and picking the
 * wrong one was punished. And nothing is refused -- finished rows go, and
 * anything unfinished stays a draft on the timesheet, which this says in
 * advance so it is not a surprise afterwards.
 *
 * The button disables itself for the duration of the request, so a double
 * click cannot file twice.
 */
export function SubmitDialog({
  open,
  onOpenChange,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onConfirmed: (outcome: SubmitOutcome) => void;
}) {
  const { weekKey, totals, submitWeek, entries, submitting } = useTimesheet();
  const { employee } = useAuth();
  const [busy, setBusy] = useState(false);

  /*
   * The same split the database will make, worked out here so the dialog can
   * say what is about to happen rather than reporting it afterwards. An
   * untouched empty row is neither: it is furniture, not unfinished work.
   */
  const meaningful = entries.filter((row) => !isBlankRow(row));
  const holding = meaningful.filter((row) => missingFields(row).length > 0);
  const ready = meaningful.length - holding.length;
  const heldDays = [...new Set(holding.map((row) => row.workDate))].sort();
  const readyHours = meaningful
    .filter((row) => missingFields(row).length === 0)
    .reduce((sum, row) => sum + (typeof row.hours === "number" ? row.hours : 0), 0);

  const confirm = async () => {
    if (busy || submitting) return;
    setBusy(true);
    try {
      const result = await submitWeek();
      onOpenChange(false);
      if (result) onConfirmed(result);
    } finally {
      setBusy(false);
    }
  };

  const pending = busy || submitting;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[430px]">
        <DialogHeader>
          <DialogTitle className="text-base">Submit this week?</DialogTitle>
          <DialogDescription className="text-[13px]">
            {ready === 0
              ? "Nothing is ready to send yet."
              : `${ready} row${ready === 1 ? "" : "s"} will be sent.`}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-lg border bg-surface-muted p-3 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Week</dt>
            <dd className="num text-right font-semibold">{weekRangeLabel(weekKey)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Hours being sent</dt>
            <dd className="num font-semibold">{formatHours(readyHours)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Billable / non-billable</dt>
            <dd className="num font-semibold">
              {formatHours(totals.billable)} / {formatHours(totals.nonBillable)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Submitting as</dt>
            <dd className="truncate text-right font-semibold">{employee?.email}</dd>
          </div>
          {employee?.primaryMarket && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Market</dt>
              <dd className="font-semibold">{MARKET_LABELS[employee.primaryMarket]}</dd>
            </div>
          )}
        </dl>

        {/*
          Said before rather than after. An unfinished row is not an error and
          does not stop anything -- it simply is not ready, and stays where it
          is until it is.
        */}
        {holding.length > 0 && (
          <p className="flex items-start gap-2 rounded-md bg-warning-soft p-2.5 text-[12px] font-medium text-warning">
            <PencilLine className="mt-0.5 size-3.5 shrink-0" />
            {holding.length} row{holding.length === 1 ? "" : "s"} on{" "}
            {heldDays.map((day) => dayLabel(day)).join(", ")} still need
            {holding.length === 1 ? "s" : ""} filling in. {holding.length === 1 ? "It" : "They"}{" "}
            will stay here as a draft and can be sent whenever you finish{" "}
            {holding.length === 1 ? "it" : "them"}.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Keep editing
          </Button>
          <Button size="sm" onClick={() => void confirm()} disabled={pending || ready === 0}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {pending ? "Submitting…" : ready === 0 ? "Nothing to send" : "Confirm and submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
