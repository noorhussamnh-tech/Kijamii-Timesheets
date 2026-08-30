import { SearchSelect } from "@/components/SearchSelect";
import type { FieldDef } from "@/lib/domain/config";
import type { TimesheetEntry } from "@/lib/domain/types";
import { parseDateKey, shortDayLabel, weekKeyOf } from "@/lib/domain/week";
import { useTimesheet } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

/**
 * Renders one cell of the grid from its field definition.
 *
 * Everything is driven by the configuration and by reference data loaded from
 * the database, so adding a field to a region's config is enough to make it
 * appear -- no branch in here needs to change.
 */
export function EntryField({
  field,
  row,
  invalid,
}: {
  field: FieldDef;
  row: TimesheetEntry;
  invalid?: boolean | undefined;
}) {
  const {
    updateRow,
    readOnly,
    weekKey,
    config,
    reference,
    availableClients,
    recentDates,
    moveRowToDate,
  } = useTimesheet();
  // The row's own status is the guard, not the day's: a day that has been
  // submitted can still take new rows.
  const disabled = readOnly || row.status !== "draft";

  const inputClass = cn(
    "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[13px] transition-colors",
    "hover:border-border-strong hover:bg-surface-muted focus:border-transparent focus:bg-surface focus:outline-2 focus:outline-ring focus:-outline-offset-1",
    invalid && "border-destructive/50 bg-destructive/5",
    disabled && "pointer-events-none opacity-80",
  );

  switch (field.kind) {
    case "date": {
      // Every date is offered, in this week or a nearby one. Nothing is
      // withheld: weekends get worked and a day can be filled in whenever.
      // Choosing a date in another week moves the row there.
      const grouped = new Map<string, string[]>();
      for (const date of recentDates) {
        const key = weekKeyOf(parseDateKey(date));
        grouped.set(key, [...(grouped.get(key) ?? []), date]);
      }
      const weeks = [...grouped.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

      return (
        <select
          value={row.workDate}
          disabled={disabled}
          aria-label="Date"
          aria-invalid={invalid}
          onChange={(event) => void moveRowToDate(row.id, event.target.value)}
          className={cn(inputClass, "num min-w-[104px]")}
        >
          {/* A date outside the offered window still shows its own value. */}
          {!recentDates.includes(row.workDate) && (
            <option value={row.workDate}>{shortDayLabel(row.workDate)}</option>
          )}
          {weeks.map(([week, dates]) => (
            <optgroup
              key={week}
              label={week === weekKey ? "This week" : `Week of ${shortDayLabel(week)}`}
            >
              {dates
                .slice()
                .sort((a, b) => (a < b ? 1 : -1))
                .map((date) => (
                  <option key={date} value={date}>
                    {shortDayLabel(date)}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      );
    }

    case "client": {
      const selected = availableClients.find((client) => client.id === row.clientId);
      return (
        <div className="space-y-1">
          <SearchSelect
            value={row.clientId}
            options={availableClients.map((client) => ({
              id: client.id,
              name: client.name,
              ...(client.sector ? { meta: client.sector } : {}),
            }))}
            placeholder="Select client"
            emptyText="No clients match"
            disabled={disabled}
            invalid={invalid}
            onChange={(id) => updateRow(row.id, { clientId: id, clientOther: "" })}
          />
          {selected?.isOther && (
            <input
              type="text"
              value={row.clientOther}
              disabled={disabled}
              maxLength={200}
              placeholder="Type client name"
              aria-label="Client name"
              onChange={(event) => updateRow(row.id, { clientOther: event.target.value })}
              className={cn(inputClass, "border-border-strong")}
            />
          )}
        </div>
      );
    }

    case "reference": {
      const options = field.source && reference ? reference[field.source] : [];
      const key = field.key as "serviceId" | "projectType" | "task";
      // Service is stored by id; project type and task are stored by name.
      const value = row[key];
      return (
        <SearchSelect
          value={value}
          options={
            key === "serviceId" ? options : options.map((o) => ({ id: o.name, name: o.name }))
          }
          placeholder={`Select ${field.label.toLowerCase()}`}
          emptyText="No matches"
          disabled={disabled}
          invalid={invalid}
          onChange={(id) => updateRow(row.id, { [key]: id } as Partial<TimesheetEntry>)}
        />
      );
    }

    case "hours":
      return (
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={config.maxHoursPerDay}
          step={config.hoursStep}
          value={row.hours}
          disabled={disabled}
          aria-label="Hours"
          aria-invalid={invalid}
          placeholder="0.00"
          onChange={(event) => {
            const raw = event.target.value;
            updateRow(row.id, { hours: raw === "" ? "" : Number(raw) });
          }}
          // Snapping on blur rather than on change keeps typing "1.5" possible.
          onBlur={(event) => {
            const raw = event.target.value;
            if (raw === "") return;
            const snapped = Math.min(
              config.maxHoursPerDay,
              Math.max(0, Math.round(Number(raw) * 4) / 4),
            );
            if (snapped !== Number(raw)) updateRow(row.id, { hours: snapped });
          }}
          className={cn(inputClass, "num min-w-[64px] text-right")}
        />
      );

    case "billable":
      return (
        <div className="flex items-center gap-1 rounded-md bg-surface-muted p-0.5">
          {[
            { value: true, label: "Billable" },
            { value: false, label: "Non-bill." },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              disabled={disabled}
              aria-pressed={row.billable === option.value}
              onClick={() => updateRow(row.id, { billable: option.value })}
              className={cn(
                "flex-1 rounded px-1.5 py-1 text-[11px] font-semibold transition-colors",
                row.billable === option.value
                  ? "bg-surface text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground",
                disabled && "pointer-events-none",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={row.projectNote}
          disabled={disabled}
          maxLength={500}
          aria-label={field.label}
          placeholder={field.hint ?? "Optional"}
          onChange={(event) => updateRow(row.id, { projectNote: event.target.value })}
          className={inputClass}
        />
      );
  }
}
