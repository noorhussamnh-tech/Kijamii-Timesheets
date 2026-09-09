import { Loader2, Save, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTimesheet } from "@/lib/timesheet-store";

/**
 * Save and submit, and nothing else -- and Submit is one button.
 *
 * It used to open a menu offering each day of the week separately and then
 * "Submit whole week" underneath. That asked people to make a choice they had
 * no reason to care about, and punished them for making the wrong one: a week
 * carrying one unfinished row refused every finished row with it. Submit now
 * sends what is ready and leaves the rest as drafts.
 *
 * This bar used to carry a running scoreboard -- hours against forty, a
 * billable split, hours remaining, a status pill. All of it is gone. A total
 * kept on screen while somebody is deciding what to write is a number being
 * managed rather than a record being kept, and "Remaining 33.75h" named the
 * exact figure to invent. What was actually logged is still in the rows, in
 * the submit dialog's receipt, and on the admin page, where it is read-only
 * and belongs to somebody else.
 */
export function SummaryBar({ onSubmit }: { onSubmit: () => void }) {
  const { saveDraft, dirty, submitting } = useTimesheet();

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t bg-surface/95 px-4 py-3 shadow-raised backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void saveDraft()}
          disabled={!dirty || submitting}
        >
          <Save className="size-3.5" /> Save draft
        </Button>
        <Button size="sm" className="gap-2 px-4" disabled={submitting} onClick={onSubmit}>
          {submitting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </div>
  );
}
