import { SearchSelect } from "@/components/SearchSelect";
import type { FieldDef } from "@/lib/domain/config";
import type { TimesheetEntry } from "@/lib/domain/types";
import { parseDateKey, shortDayLabel, weekKeyOf } from "@/lib/domain/week";
import { useTimesheet } from "@/lib/timesheet-store";
import { cn } from "@/lib/utils";

/**
 * Whether a required field still has nothing in it.
 *
 * Kept beside the rendering rather than in the validation module: this drives
 * an outline, not a verdict, and a half-typed row should not be told off.
 */
function isUnanswered(key: FieldDef["key"], row: TimesheetEntry): boolean {
  switch (key) {
    case "clientId":
      return !row.clientId && !row.clientOther.trim();
    case "projectType":
      return !row.projectType;
    case "scope":
      return !row.scope;
    case "hours":
      return row.hours === "";
    default:
      return false;
  }
}

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
  const { updateRow, weekKey, config, reference, availableClients, recentDates, moveRowToDate } =
    useTimesheet();
  // The row's own status is the guard, not the day's: a day that has been
  // submitted can still take new rows.
  // Nothing here is frozen. A submitted row can still be corrected -- the
  // database records the amendment rather than refusing it.
  const disabled = false;

  // Whether this field is still waiting on the person. Only ever true for the
  // ones that must be answered -- Notes is optional and is never dressed up as
  // an outstanding task.
  const awaiting = field.required && isUnanswered(field.key, row);

  /*
   * Fields carry a visible border at rest now, rather than appearing only on
   * hover. A grid of invisible inputs looks calm and reads as a table nobody
   * is allowed to type in.
   *
   * The colour says something rather than decorating: amber where an answer is
   * still owed, plain grey once it has been given, red only when it is wrong.
   * Green is deliberately not used here -- it already means submitted and
   * done elsewhere in this app, and a grid where every empty box is green
   * teaches people to read green as nothing at all.
   */
  const stateClass = cn(
    "border-input",
    awaiting && "border-warning/60 bg-warning-soft/40",
    invalid && "border-destructive/60 bg-destructive/5",
  );

  const inputClass = cn(
    "w-full rounded-md border bg-transparent px-2 py-1.5 text-[13px] transition-colors",
    "hover:border-border-strong hover:bg-surface-muted focus:bg-surface focus:outline-2 focus:outline-ring focus:-outline-offset-1",
    stateClass,
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
            className={stateClass}
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
          className={stateClass}
          onChange={(id) => updateRow(row.id, { [key]: id } as Partial<TimesheetEntry>)}
        />
      );
    }

    case "choice": {
      // A short, fixed set: a plain select rather than the searchable list
      // used for the reference fields, which can run to dozens of options.
      const value = row[field.key as "scope"] ?? "";
      return (
        <select
          value={value}
          disabled={disabled}
          aria-label={field.label}
          aria-invalid={invalid}
          onChange={(event) =>
            updateRow(row.id, {
              [field.key]: event.target.value === "" ? null : event.target.value,
            } as Partial<TimesheetEntry>)
          }
          className={cn(inputClass, "min-w-[130px]", value === "" && "text-muted-foreground")}
        >
          {/* Nothing is preselected: the classification has to be chosen. */}
          <option value="">Select {field.label.toLowerCase()}</option>
          {(field.choices ?? []).map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
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
