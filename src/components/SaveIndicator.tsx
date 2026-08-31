import { AlertCircle, Check, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

import { useTimesheet } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

/**
 * Reports what the database has actually accepted.
 *
 * "Saved" appears only after a confirmed write. A failure says so plainly and
 * offers a retry rather than quietly showing a stale success.
 */
export function SaveIndicator({ className }: { className?: string | undefined }) {
  const { saveState, lastSavedAt, dirty, saveDraft, saveError } = useTimesheet();

  if (saveState === "error") {
    return (
      <button
        type="button"
        onClick={() => void saveDraft()}
        title={saveError ?? undefined}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-medium text-destructive hover:underline",
          className,
        )}
      >
        <AlertCircle className="size-3" /> Save failed — retry
      </button>
    );
  }

  if (saveState === "saving") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    );
  }

  if (dirty) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
          className,
        )}
      >
        <RefreshCw className="size-3" /> Unsaved changes
      </span>
    );
  }

  if (lastSavedAt) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
          className,
        )}
      >
        <Check className="size-3 text-success" /> Saved {format(new Date(lastSavedAt), "HH:mm")}
      </span>
    );
  }

  return null;
}
