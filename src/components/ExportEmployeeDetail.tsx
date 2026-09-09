import { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, Download, Loader2 } from "lucide-react";

import { SearchSelect } from "@/components/SearchSelect";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchEmployeeDetail, type EmployeeDetailExport } from "@/lib/data/api";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import { VIEW_GROUPS, viewById } from "@/lib/export/views";
import type { DetailEmployee } from "@/lib/export/employee-detail";

/**
 * A detailed read on one person's period, or on everybody's.
 *
 * Separate from the Time Dedication export, which answers the job book's
 * question. This one answers "what did this person actually do", which is a
 * different question with different columns and a different audience.
 */
export function ExportEmployeeDetail({
  from,
  to,
  market,
  department,
}: {
  /** The period chosen in the toolbar. */
  from: string;
  to: string;
  /** The admin page's own filters. "all" means unfiltered. */
  market: string;
  department: string;
}) {
  const [employeeId, setEmployeeId] = useState("all");
  const [view, setView] = useState<string>("full-detail");
  const [roster, setRoster] = useState<DetailEmployee[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // The roster comes from the same function that serves the rows, so the names
  // in this list are exactly the ones the file can contain.
  useEffect(() => {
    let cancelled = false;
    void fetchEmployeeDetail(from, to, null)
      .then((data) => {
        if (!cancelled) setRoster(data.employees);
      })
      .catch(() => {
        // The picker simply stays on "everyone", which still exports.
        if (!cancelled) setRoster([]);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  /*
   * The people this export can name, narrowed by whatever the page above is
   * filtered to. Somebody who has filtered the table down to Account
   * Management and then opens this expects to be choosing from that list, not
   * from the whole company.
   */
  const visible = roster.filter(
    (person) =>
      (market === "all" || person.primaryMarket === market) &&
      (department === "all" || person.department === department),
  );

  // A person who falls outside the filters must not stay silently selected:
  // the file would not match the name shown on the trigger.
  useEffect(() => {
    if (employeeId !== "all" && !visible.some((person) => person.id === employeeId)) {
      setEmployeeId("all");
    }
  }, [employeeId, visible]);

  /** Applies the page's filters to what the file will actually contain. */
  const narrow = (data: EmployeeDetailExport): EmployeeDetailExport => ({
    ...data,
    employees: data.employees.filter(
      (person) =>
        (market === "all" || person.primaryMarket === market) &&
        (department === "all" || person.department === department),
    ),
    rows: data.rows.filter(
      (row) =>
        (market === "all" || row.market === market) &&
        (department === "all" || row.department === department),
    ),
  });

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);

    const who = employeeId === "all" ? null : employeeId;
    const person = roster.find((entry) => entry.id === employeeId);
    const slug = (person?.name ?? "everyone").toLowerCase().replace(/[^a-z0-9]+/g, "-");

    try {
      const data = narrow(await fetchEmployeeDetail(from, to, who));

      const chosen = viewById(view);
      const shaped = chosen.shape(data);

      if (shaped.rows.length === 0) {
        setNote("Nothing submitted in that month.");
        return;
      }

      downloadCsv(
        `kijamii-${slug}_${chosen.id}_${from}_to_${to}.csv`,
        toCsv(shaped.headers, shaped.rows),
      );

      /*
       * Say how many people are actually in the file, not just how many rows.
       *
       * Exporting "Everyone" and receiving one name is alarming, and the file
       * itself cannot tell you whether the others logged nothing or the export
       * quietly dropped them. Naming the count answers that before it is asked.
       */
      const withRows = new Set(data.rows.map((row) => row.employeeId)).size;
      const roster = data.employees.length;
      const people =
        employeeId === "all" && roster > 0
          ? ` · ${withRows} of ${roster} ${roster === 1 ? "person" : "people"} logged anything`
          : "";
      setNote(`${shaped.rows.length} row${shaped.rows.length === 1 ? "" : "s"}${people}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          Employee detail
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] space-y-3 p-3">
        <div className="space-y-1">
          <p className="label-xs">Employee detail</p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            A close read on one person, over the period chosen above. Every view is folded from the
            same rows, so the totals always agree.
          </p>
        </div>

        {/* Typing rather than scrolling: a plain select of 133 names is a
            list you hunt through, and the name is the one thing the person
            opening this already knows. */}
        <div className="flex items-center gap-2">
          <span className="label-xs-muted w-14 shrink-0">Person</span>
          <SearchSelect
            className="h-8 flex-1 text-[13px]"
            value={employeeId}
            placeholder="Search by name"
            emptyText="No one by that name"
            onChange={setEmployeeId}
            options={[
              {
                id: "all",
                name: "Everyone",
                ...(market !== "all" || department !== "all" ? { meta: "in this filter" } : {}),
              },
              ...visible.map((person) => ({
                id: person.id,
                name: person.name,
                ...(person.department ? { meta: person.department } : {}),
              })),
            ]}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="label-xs-muted w-14 shrink-0">View</span>
          <Select value={view} onValueChange={setView}>
            <SelectTrigger className="h-8 flex-1 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIEW_GROUPS.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel className="label-xs">{group.label}</SelectLabel>
                  {group.views.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="px-0.5 text-[11px] text-muted-foreground">{viewById(view).note}</p>

        <Button size="sm" className="w-full" disabled={busy} onClick={() => void run()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          Download
        </Button>

        {note && <p className="text-[12px] text-muted-foreground">{note}</p>}
        {error && (
          <p className="inline-flex items-start gap-1 text-[12px] font-medium text-destructive">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
