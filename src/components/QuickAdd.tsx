import { useMemo, useState } from "react";
import { CornerDownLeft, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { parseQuickAdd } from "@/lib/domain/quick-add";
import { useTimesheet } from "@/lib/timesheet-store";

/**
 * One line instead of five dropdowns.
 *
 * "myf copy 3h" becomes a complete row. What it understood is shown before
 * committing, and anything it could not place goes into the note rather than
 * being forced onto the nearest field -- a wrong guess costs more than a gap.
 */
export function QuickAdd() {
  const { reference, availableClients, addQuickRow, defaultEntryDate, readOnly } = useTimesheet();
  const [text, setText] = useState("");

  const sources = useMemo(
    () => ({
      clients: availableClients.map((c) => ({ id: c.id, name: c.name })),
      services: reference?.services ?? [],
      projectTypes: reference?.projectTypes ?? [],
      taskTypes: reference?.taskTypes ?? [],
    }),
    [availableClients, reference],
  );

  const parsed = useMemo(
    () => (text.trim() ? parseQuickAdd(text, sources) : null),
    [text, sources],
  );

  if (readOnly || !reference) return null;

  const commit = () => {
    if (!parsed) return;
    addQuickRow({
      workDate: defaultEntryDate,
      clientId: parsed.clientId ?? "",
      serviceId: parsed.serviceId ?? "",
      projectType: parsed.projectType ?? "",
      task: parsed.task ?? "",
      projectNote: parsed.leftover,
      hours: parsed.hours ?? "",
    });
    setText("");
  };

  return (
    <div className="rounded-lg border bg-surface p-2.5 shadow-card">
      <div className="flex items-center gap-2">
        <Zap className="size-4 shrink-0 text-brand" />
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") setText("");
          }}
          placeholder="Quick add — try: MYF copy 3h"
          aria-label="Quick add an entry"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
        <Button size="sm" variant="outline" disabled={!parsed} onClick={commit}>
          <CornerDownLeft className="size-3.5" /> Add
        </Button>
      </div>

      {parsed && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2 text-[11px]">
          {parsed.matched.map((match) => (
            <span
              key={`${match.field}-${match.label}`}
              className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand"
            >
              {match.label}
            </span>
          ))}
          {parsed.hours !== null && (
            <span className="num rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">
              {parsed.hours}h
            </span>
          )}
          {parsed.leftover && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-muted-foreground">
              note: {parsed.leftover}
            </span>
          )}
          <span className="ml-auto text-muted-foreground">
            {parsed.matched.length === 0
              ? "Nothing recognised — it will go in as a note"
              : "Press Enter to add"}
          </span>
        </div>
      )}
    </div>
  );
}
