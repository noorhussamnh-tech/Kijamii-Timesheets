import { useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { syncDirectory } from "@/lib/data/api";

/**
 * Re-reads the company employee list onto every roster record.
 *
 * The directory decides each person's department, title, function and region,
 * and signing in re-applies it, so nobody has to press this for their own
 * details to be right. It is here for the two cases signing in cannot cover:
 * the sheet changed under somebody who is already here, and a new joiner who
 * should appear in the reports before their first login.
 */
export function SyncDirectory() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await syncDirectory();
      /*
       * Report what is still unresolved, not just what worked.
       *
       * The two counts that matter are the ones an admin would otherwise have
       * to go looking for: somebody the sheet describes too thinly to give a
       * timesheet, and somebody on the roster the sheet no longer mentions.
       * Neither is treated as a failure -- a sync never switches anybody off --
       * but both are somebody's job to look at.
       */
      const flags = [
        result.created > 0 ? `${result.created} added` : null,
        result.unmapped > 0 ? `${result.unmapped} without a region` : null,
        result.not_in_directory > 0 ? `${result.not_in_directory} not in the sheet` : null,
      ].filter(Boolean);
      setNote(
        `${result.applied} of ${result.directory_rows} applied` +
          (flags.length > 0 ? ` · ${flags.join(" · ")}` : " · nothing outstanding"),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The sync failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void run()}>
        <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} /> Sync directory
      </Button>
      {note && <span className="text-[12px] text-muted-foreground">{note}</span>}
      {error && (
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-destructive">
          <AlertCircle className="size-3.5" /> {error}
        </span>
      )}
    </div>
  );
}
