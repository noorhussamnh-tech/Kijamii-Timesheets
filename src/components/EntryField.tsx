import { format } from "date-fns";
import { SearchSelect } from "@/components/SearchSelect";
import { clientsForVertical, getClient } from "@/data/reference";
import type { FieldDef } from "@/data/timesheet-config";
import type { TimesheetEntry } from "@/data/weeks";
import { weekDays } from "@/data/weeks";
import { cn } from "@/lib/utils";
import { useTimesheet } from "@/lib/timesheet-store";


export function EntryField({
  field,
  row,
  invalid,
}: {
  field: FieldDef;
  row: TimesheetEntry;
  invalid?: boolean | undefined;
}) {
  const { updateRow, readOnly, marketId, weekKey, config, isDayLocked } = useTimesheet();
  const disabled = readOnly || isDayLocked(row.date);

  const inputClass = cn(
    "w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[13px] transition-colors",
    "hover:border-border-strong hover:bg-surface-muted focus:border-transparent focus:bg-surface focus:outline-2 focus:outline-ring focus:-outline-offset-1",
    invalid && "border-destructive/50 bg-destructive/5",
    disabled && "pointer-events-none",
  );


  switch (field.kind) {
    case "date": {
      const days = weekDays(weekKey);
      return (
        <select
          value={row.date}
          disabled={disabled}
          onChange={(e) => updateRow(row.id, { date: e.target.value })}
          className={cn(inputClass, "num min-w-[104px]")}
        >
          {days.map((d) => (
            <option key={d.toISOString()} value={format(d, "yyyy-MM-dd")}>
              {format(d, "EEE d MMM")}
            </option>
          ))}
        </select>
      );
    }
    case "client": {
      const options = clientsForVertical(marketId).map((c) => ({ id: c.id, name: c.name }));
      const isOther = getClient(row.clientId)?.other === true;
      return (
        <div className="space-y-1">
          <SearchSelect
            value={row.clientId}
            options={options}
            placeholder="Select client"
            onChange={(id) => updateRow(row.id, { clientId: id, clientOther: "" })}
            disabled={disabled}
            invalid={invalid}
          />
          {isOther && (
            <input
              type="text"
              value={row.clientOther ?? ""}
              disabled={disabled}
              placeholder="Type client name"
              onChange={(e) => updateRow(row.id, { clientOther: e.target.value })}
              className={cn(inputClass, "border-border-strong")}
            />
          )}
        </div>
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
          onChange={(e) => {
            const v = e.target.value;
            updateRow(row.id, {
              hours: v === "" ? "" : Math.min(config.maxHoursPerDay, Math.max(0, Number(v))),
            });
          }}
          placeholder="0.00"
          className={cn(inputClass, "num min-w-[64px] text-right")}
        />
      );
    case "billable":
      return (
        <div className="flex items-center gap-1 rounded-md bg-surface-muted p-0.5">
          {[
            { v: true, label: "Billable" },
            { v: false, label: "Non-bill." },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              disabled={disabled}
              onClick={() => updateRow(row.id, { billable: o.v })}
              className={cn(
                "flex-1 rounded px-1.5 py-1 text-[11px] font-semibold transition-colors",
                row.billable === o.v
                  ? "bg-surface text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground",
                disabled && "pointer-events-none",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    case "select": {
      const key = field.key as "costCenter" | "location" | "projectType" | "task" | "serviceId";
      return (
        <SearchSelect
          value={(row[key] as string) ?? ""}
          options={field.options ?? []}
          placeholder={`Select ${field.label.toLowerCase()}`}
          onChange={(id) => updateRow(row.id, { [key]: id })}
          disabled={disabled}
          invalid={invalid}
        />
      );
    }
    default: {
      const key = field.key as "task" | "notes";
      return (
        <input
          type="text"
          value={row[key] ?? ""}
          disabled={disabled}
          placeholder={field.hint ?? "Optional"}
          onChange={(e) => updateRow(row.id, { [key]: e.target.value })}
          className={inputClass}
        />
      );
    }
  }
}
