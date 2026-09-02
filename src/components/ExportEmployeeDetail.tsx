import { useEffect, useState } from "react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { AlertCircle, ChevronDown, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchEmployeeDetail, type EmployeeDetailExport } from "@/lib/data/api";
import { toDateKey } from "@/lib/domain/week";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import {
  type DetailEmployee,
  fullDetailView,
  perAccountByDayView,
  perAccountView,
  perDayView,
  perTitleView,
  summaryView,
} from "@/lib/export/employee-detail";

/**
 * The views on offer.
 *
 * Each is a fold of the same fetched rows rather than its own query, so the
 * total on one and the days on another cannot drift apart.
 */
const VIEWS = [
  {
    id: "full-detail",
    label: "Full detail (every entry)",
    note: "One row per logged entry. Every view below pivots out of this one.",
    shape: (data: EmployeeDetailExport) => fullDetailView(data.rows),
  },
  {
    id: "summary",
    label: "Summary",
    note: "Total hours, days logged, accounts touched.",
    shape: (data: EmployeeDetailExport) => summaryView(data.rows, data.employees),
  },
  {
    id: "per-day",
    label: "Hours per day",
    note: "One line per person per day.",
    shape: (data: EmployeeDetailExport) => perDayView(data.rows),
  },
  {
    id: "per-account",
    label: "Hours per account",
    note: "With each account's share of their time.",
    shape: (data: EmployeeDetailExport) => perAccountView(data.rows),
  },
  {
    id: "account-by-day",
    label: "Hours per account, by day",
    note: "A grid: accounts down, days across.",
    shape: (data: EmployeeDetailExport) => perAccountByDayView(data.rows),
  },
  {
    id: "per-title",
    label: "Hours per title",
    note: "Needs titles loaded; unset people are grouped, not dropped.",
    shape: (data: EmployeeDetailExport) => perTitleView(data.rows),
  },
] as const;

function monthOptions(count = 12): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const month = subMonths(now, index);
    return { value: format(month, "yyyy-MM"), label: format(month, "MMMM yyyy") };
  });
}

/**
 * A detailed read on one person's month, or on everybody's.
 *
 * Separate from the Time Dedication export, which answers the job book's
 * question. This one answers "what did this person actually do", which is a
 * different question with different columns and a different audience.
 */
export function ExportEmployeeDetail({
  market,
  department,
}: {
  /** The admin page's own filters. "all" means unfiltered. */
  market: string;
  department: string;
}) {
  const months = monthOptions();
  const [month, setMonth] = useState(months[0]!.value);
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
    const now = new Date();
    void fetchEmployeeDetail(toDateKey(startOfMonth(now)), toDateKey(endOfMonth(now)), null)
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
  }, []);

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

    const [year, monthNumber] = month.split("-").map(Number);
    const anchor = new Date(year!, monthNumber! - 1, 1);
    const who = employeeId === "all" ? null : employeeId;
    const person = roster.find((entry) => entry.id === employeeId);
    const slug = (person?.name ?? "everyone").toLowerCase().replace(/[^a-z0-9]+/g, "-");

    try {
      const data = narrow(
        await fetchEmployeeDetail(
          toDateKey(startOfMonth(anchor)),
          toDateKey(endOfMonth(anchor)),
          who,
        ),
      );

      const chosen = VIEWS.find((option) => option.id === view) ?? VIEWS[0];
      const shaped = chosen.shape(data);

      if (shaped.rows.length === 0) {
        setNote("Nothing submitted in that month.");
        return;
      }

      downloadCsv(`kijamii-${slug}_${month}_${chosen.id}.csv`, toCsv(shaped.headers, shaped.rows));
      setNote(`${shaped.rows.length} row${shaped.rows.length === 1 ? "" : "s"} downloaded.`);
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
            A close read on one person&apos;s month, or everybody&apos;s. Every view is folded from
            the same rows, so the totals always agree.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="label-xs-muted w-14 shrink-0">Person</span>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="h-8 flex-1 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Everyone
                {(market !== "all" || department !== "all") && (
                  <span className="ml-2 text-[11px] text-muted-foreground">in this filter</span>
                )}
              </SelectItem>
              {visible.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="label-xs-muted w-14 shrink-0">Month</span>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-8 flex-1 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="label-xs-muted w-14 shrink-0">View</span>
          <Select value={view} onValueChange={setView}>
            <SelectTrigger className="h-8 flex-1 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIEWS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="px-0.5 text-[11px] text-muted-foreground">
          {VIEWS.find((option) => option.id === view)?.note}
        </p>

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
