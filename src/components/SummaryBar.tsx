import { ChevronUp, Loader2, Save, Send } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/StatusBadge";
import { useTimesheet } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

const h = (n: number) => `${n % 1 === 0 ? n : n.toFixed(2)}h`;

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "brand" | undefined;
}) {
  return (
    <div className="min-w-0">
      <p className="label-xs">{label}</p>
      <p
        className={cn(
          "num text-[15px] font-bold",
          tone === "warn" && "text-warning",
          tone === "brand" && "text-brand",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function SummaryBar({
  onSubmitDay,
  onSubmitWeek,
}: {
  onSubmitDay: (date: string) => void;
  onSubmitWeek: () => void;
}) {
  const { totals, status, readOnly, saveDraft, dirty, reopenDraft, visibleDates, isDayLocked } =
    useTimesheet();

  const openDays = visibleDates.filter((d) => !isDayLocked(d));
  const targetDay = openDays[openDays.length - 1];
  const dayLabel = targetDay ? format(new Date(`${targetDay}T00:00:00`), "EEEE") : "day";

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t bg-surface/95 px-4 py-3 shadow-raised backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:gap-6">
          <Stat label="Total" value={h(totals.total)} />
          <div className="min-w-0">
            <p className="label-xs">Status</p>
            <StatusBadge status={status} className="mt-0.5" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {readOnly ? (
            <>
              <span className="text-[12px] text-muted-foreground">
                This week is read-only after submission.
              </span>
              <Button variant="outline" size="sm" onClick={reopenDraft}>
                Edit as draft
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={saveDraft} disabled={!dirty}>
                {dirty ? <Save className="size-3.5" /> : <Loader2 className="size-3.5" />}
                Save draft
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-2 px-4">
                    <Send className="size-3.5" /> Submit
                    <ChevronUp className="size-3.5 opacity-80" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-48">
                  <DropdownMenuItem
                    disabled={!targetDay}
                    onClick={() => targetDay && onSubmitDay(targetDay)}
                  >
                    Submit ({dayLabel})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onSubmitWeek}>Submit Week</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>

          )}
        </div>
      </div>
    </div>
  );
}
