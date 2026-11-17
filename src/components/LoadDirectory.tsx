import { useRef, useState } from "react";
import { AlertCircle, Check, FileUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { importDirectory, type DirectoryImportResult } from "@/lib/data/api";
import { parseDirectoryCsv, type ParsedDirectory } from "@/lib/directory/parse";

/**
 * Loads the OPS employee list into the directory.
 *
 * This is the half Sync Directory never had. That button pushes the directory
 * onto the roster, which is useful, but nothing could put anything *into* the
 * directory: a new joiner stayed invisible until somebody wrote a migration by
 * hand, which is why Bassma Elkaramany signed in on 2 November and could not
 * log an hour until the 17th.
 *
 * It takes a file rather than reading the sheet directly, and that is not
 * laziness. The repo already records the attempt: Kijamii's Workspace policy
 * blocks sharing a spreadsheet with an external service account, so the
 * database cannot go and fetch it. Downloading the tab as CSV and dropping it
 * here is the shortest path that does not need that policy changed.
 *
 * Nothing is written until the preview has been seen. The first call is a dry
 * run returning exactly what the real one would, so what is agreed to is what
 * happens.
 */
export function LoadDirectory() {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedDirectory | null>(null);
  const [preview, setPreview] = useState<DirectoryImportResult | null>(null);
  const [done, setDone] = useState<DirectoryImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setParsed(null);
    setPreview(null);
    setDone(null);
    setError(null);
    setFile(null);
    if (input.current) input.current.value = "";
  };

  const choose = async (chosen: File | undefined) => {
    if (!chosen) return;
    reset();
    setFile(chosen.name);
    setBusy(true);
    try {
      const read = parseDirectoryCsv(await chosen.text());
      setParsed(read);
      setOpen(true);

      const blocking = read.problems.filter((p) => p.blocking);
      if (read.people.length === 0 || blocking.length > 0) return;

      setPreview(await importDirectory(read.people, read.dedication, false));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The file could not be read.");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!parsed || busy) return;
    setBusy(true);
    setError(null);
    try {
      setDone(await importDirectory(parsed.people, parsed.dedication, true));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The list could not be loaded.");
    } finally {
      setBusy(false);
    }
  };

  const blocking = parsed?.problems.filter((p) => p.blocking) ?? [];
  const skipped = parsed?.problems.filter((p) => !p.blocking) ?? [];
  const refused = preview !== null && !preview.ok;
  const canApply = parsed !== null && blocking.length === 0 && preview !== null && preview.ok;

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-9 gap-1.5 px-3 text-[13px]"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy && !open ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileUp className="size-3.5" />
        )}
        Load employee list
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{done ? "Employee list loaded" : "Load the employee list"}</DialogTitle>
            <DialogDescription>
              {done
                ? "The directory now matches the file."
                : file
                  ? `From ${file}. Nothing is written until you choose to.`
                  : "Download the OPS list as CSV and choose it here."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[52vh] space-y-3 overflow-y-auto text-[13px]">
            {error && (
              <p className="flex items-start gap-1.5 font-medium text-destructive">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {error}
              </p>
            )}

            {blocking.length > 0 && (
              <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="font-semibold text-destructive">
                  The list contradicts itself, so none of it can be loaded.
                </p>
                <ul className="mt-1.5 space-y-1 text-muted-foreground">
                  {blocking.map((p, i) => (
                    <li key={i}>
                      {p.line > 0 && <span className="tabular-nums">Row {p.line}: </span>}
                      {p.detail}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Fix these in the sheet, download it again, and come back.
                </p>
              </section>
            )}

            {refused && preview && (
              <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="font-semibold text-destructive">Refused. Nothing was written.</p>
                <ul className="mt-1.5 space-y-1 text-muted-foreground">
                  {preview.problems.map((p, i) => (
                    <li key={i}>
                      {p.email}: {p.detail}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(preview ?? done) && !refused && (
              <section className="rounded-lg border border-border bg-muted/40 p-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {(
                    [
                      ["People in the file", (done ?? preview)!.people],
                      ["New to the directory", (done ?? preview)!.added],
                      [done ? "Updated" : "Would be updated", (done ?? preview)!.changed],
                      ["Already correct", (done ?? preview)!.unchanged],
                      ["In the directory, not the file", (done ?? preview)!.absent_from_list],
                      ["New teams", (done ?? preview)!.new_teams],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-semibold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                {(done ?? preview)!.absent_from_list > 0 && (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Nobody is removed. A name missing from a spreadsheet is not a resignation.
                  </p>
                )}
              </section>
            )}

            {skipped.length > 0 && !done && (
              <section className="rounded-lg border border-border p-3">
                <p className="font-semibold">
                  {skipped.length} row{skipped.length === 1 ? "" : "s"} will be skipped
                </p>
                <ul className="mt-1.5 space-y-1 text-muted-foreground">
                  {skipped.slice(0, 8).map((p, i) => (
                    <li key={i}>
                      <span className="tabular-nums">Row {p.line}: </span>
                      {p.detail}
                    </li>
                  ))}
                  {skipped.length > 8 && <li>and {skipped.length - 8} more.</li>}
                </ul>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Somebody with no company address cannot hold a timesheet. The rest still loads.
                </p>
              </section>
            )}

            {done && (
              <p className="flex items-center gap-1.5 font-medium text-success">
                <Check className="size-4" /> {done.added} added, {done.changed} updated.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              {done ? "Close" : "Cancel"}
            </Button>
            {!done && (
              <Button size="sm" disabled={!canApply || busy} onClick={() => void apply()}>
                {busy && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Load it
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
