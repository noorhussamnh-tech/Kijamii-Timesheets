import { useState } from "react";
import { AlertTriangle, Loader2, Lock } from "lucide-react";

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
import { dayLabel, weekRangeLabel } from "@/lib/domain/week";
import { useTimesheet } from "@/lib/timesheet-store";

/**
 * Explicit confirmation before anything is frozen. The button disables itself
 * for the duration of the request, so a double click cannot submit twice --
 * and even if one got through, the database would return the existing record
 * rather than create a second one.
 */
export function SubmitDialog({
  open,
  onOpenChange,
  onConfirmed,
  date,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onConfirmed: () => void;
  date?: string | null | undefined;
}) {
  const { weekKey, totals, submitWeek, submitDay, entries, submitting } = useTimesheet();
  const { employee } = useAuth();
  const [busy, setBusy] = useState(false);

  const isDay = Boolean(date);
  const dayTotal = date
    ? entries
        .filter((row) => row.workDate === date)
        .reduce((sum, row) => sum + (typeof row.hours === "number" ? row.hours : 0), 0)
    : 0;

  const confirm = async () => {
    if (busy || submitting) return;
    setBusy(true);
    try {
      const result = date ? await submitDay(date) : await submitWeek();
      onOpenChange(false);
      if (result) onConfirmed();
    } finally {
      setBusy(false);
    }
  };

  const pending = busy || submitting;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[430px]">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isDay ? "Submit this day?" : "Submit this week?"}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Check the totals below before submitting.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-lg border bg-surface-muted p-3 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{isDay ? "Day" : "Week"}</dt>
            <dd className="num text-right font-semibold">
              {isDay && date ? dayLabel(date) : weekRangeLabel(weekKey)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Total hours</dt>
            <dd className="num font-semibold">{formatHours(isDay ? dayTotal : totals.total)}</dd>
          </div>
          {!isDay && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Billable / non-billable</dt>
              <dd className="num font-semibold">
                {formatHours(totals.billable)} / {formatHours(totals.nonBillable)}
              </dd>
            </div>
          )}
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

        {!isDay && totals.missing > 0 && (
          <p className="flex items-start gap-2 rounded-md bg-warning-soft p-2.5 text-[12px] font-medium text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            You are {formatHours(totals.missing)} below the expected {formatHours(totals.expected)}.
            You can still submit.
          </p>
        )}

        <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          {isDay
            ? "This day's entries become read-only. The rest of the week stays editable."
            : "Submitted entries become read-only. An admin can reopen the week if a correction is needed."}
        </p>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Keep editing
          </Button>
          <Button size="sm" onClick={() => void confirm()} disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {pending ? "Submitting…" : "Confirm and submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
