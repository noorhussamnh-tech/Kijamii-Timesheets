import { useState } from "react";
import { AlertCircle, Check, Loader2, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportWeekToSheets } from "@/lib/sheets/export";
import { cn } from "@/lib/utils";

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

/**
 * Sends one week's submitted entries to the Google Sheet.
 *
 * Not currently mounted: Kijamii's Workspace policy blocks sharing a
 * spreadsheet with an external service account, so the CSV download is used
 * instead. Kept because it is complete and tested -- re-enable by rendering it
 * beside <ExportCsv /> in the admin toolbar and setting the three
 * GOOGLE_* environment variables.
 *
 * Disabled while a request is in flight so a double click cannot append the
 * same week twice. The export is additive, so re-running it deliberately does
 * append a second copy -- the button says so rather than pretending otherwise.
 */
export function ExportToSheets({ weekStart }: { weekStart: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const run = async () => {
    if (state.kind === "working") return;
    setState({ kind: "working" });
    try {
      const result = await exportWeekToSheets({ data: { weekStart } });
      setState(
        result.ok
          ? { kind: "done", message: result.message }
          : { kind: "error", message: result.message },
      );
    } catch {
      setState({ kind: "error", message: "The export could not be reached. Please try again." });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void run()}
        disabled={state.kind === "working"}
      >
        {state.kind === "working" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Table2 className="size-3.5" />
        )}
        {state.kind === "working" ? "Exporting…" : "Export to Google Sheets"}
      </Button>

      {(state.kind === "done" || state.kind === "error") && (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[12px] font-medium",
            state.kind === "done" ? "text-success" : "text-destructive",
          )}
        >
          {state.kind === "done" ? (
            <Check className="size-3.5" />
          ) : (
            <AlertCircle className="size-3.5" />
          )}
          {state.message}
        </span>
      )}
    </div>
  );
}
