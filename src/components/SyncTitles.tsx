import { useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { syncTitlesFromDirectory } from "@/lib/data/api";

/**
 * Re-applies job titles from the agency directory.
 *
 * The directory is loaded from the job book's Employee Mapping tab and is the
 * authority on titles; this is the button that pushes a change there onto the
 * accounts that already exist. New accounts pick their title up on sign-in
 * without anybody pressing anything, so this is only for edits to people who
 * are already here.
 */
export function SyncTitles() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await syncTitlesFromDirectory();
      // Report what changed and what is still unresolved, rather than "done":
      // an admin needs to know whether anybody was left without a title.
      const missing = result.accounts_without_title;
      setNote(
        `${result.updated} updated of ${result.matched} matched` +
          (missing > 0 ? ` · ${missing} still without a title` : " · everybody has a title"),
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
        <RefreshCw className={busy ? "size-3.5 animate-spin" : "size-3.5"} /> Sync titles
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
