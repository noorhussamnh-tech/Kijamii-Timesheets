import { AlertTriangle, Lock } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTimesheet } from "@/lib/timesheet-store";
import { weekRangeLabel } from "@/data/weeks";
import { getVertical } from "@/data/reference";


export function SubmitDialog({
  open,
  onOpenChange,
  onConfirmed,
  date,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirmed: () => void;
  date?: string | null | undefined;
}) {
  const { weekKey, totals, submitWeek, submitDay, employee, marketId, entries } = useTimesheet();
  const vertical = getVertical(marketId);
  const isDay = Boolean(date);
  const dayTotal = date
    ? entries
        .filter((r) => r.date === date)
        .reduce((a, r) => a + (typeof r.hours === "number" ? r.hours : 0), 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isDay ? "Submit this day?" : "Submit this week?"}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            Review the totals below before submitting.
          </DialogDescription>
        </DialogHeader>
        <dl className="space-y-2 rounded-lg border bg-surface-muted p-3 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{isDay ? "Day" : "Week"}</dt>
            <dd className="num font-semibold">
              {isDay ? format(new Date(`${date}T00:00:00`), "EEEE d MMM yyyy") : weekRangeLabel(weekKey)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Vertical</dt>
            <dd className="font-semibold">{vertical.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total hours</dt>
            <dd className="num font-semibold">{isDay ? dayTotal : totals.total}h</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Submitting as</dt>
            <dd className="font-semibold">{employee.email}</dd>
          </div>
        </dl>

        {!isDay && totals.missing > 0 && (
          <p className="flex items-start gap-2 rounded-md bg-warning-soft p-2.5 text-[12px] font-medium text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            You are {totals.missing}h below the expected {totals.expected}h. You can still submit.
          </p>
        )}
        <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          {isDay
            ? "This day's entries become read-only. The rest of the week stays editable."
            : "Submitted entries become read-only. You can reopen the week as a draft if a correction is needed."}
        </p>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Keep editing
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (date) submitDay(date);
              else submitWeek();
              onOpenChange(false);
              onConfirmed();
            }}
          >
            Confirm and submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
