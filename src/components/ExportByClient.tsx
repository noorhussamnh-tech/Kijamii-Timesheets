import { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, Download, Loader2 } from "lucide-react";

import { SearchSelect } from "@/components/SearchSelect";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchEmployeeDetail, type EmployeeDetailExport } from "@/lib/data/api";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import { clientStaffingView, clientsIn } from "@/lib/export/employee-detail";

/**
 * The team on one account: who worked on it, and who they are.
 *
 * A file per client rather than one file listing every client, because that is
 * how the question is asked -- a sheet for Castrol, another for Carrefour --
 * and because the answer usually goes to somebody who should see the one
 * account and not the rest of the book.
 *
 * The rows are fetched once and kept, so choosing a second client after the
 * first is a re-fold rather than a second wait.
 */
export function ExportByClient({
  from,
  to,
  market,
  department,
}: {
  from: string;
  to: string;
  /** The page's own filters. "all" means unfiltered. */
  market: string;
  department: string;
}) {
  const [data, setData] = useState<EmployeeDetailExport | null>(null);
  const [client, setClient] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    setClient("");
    setNote(null);
    void fetchEmployeeDetail(from, to, null)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  /*
   * Narrowed by the page's filters before the client list is built, so the
   * options are the accounts this filter can actually produce a file for --
   * rather than offering one and then downloading an empty sheet.
   */
  const narrowed: EmployeeDetailExport | null = data && {
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
  };

  const clients = narrowed ? clientsIn(narrowed.rows) : [];

  const run = () => {
    if (!narrowed || !client || busy) return;
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      const shaped = clientStaffingView(narrowed.rows, narrowed.employees, client);
      if (shaped.rows.length === 0) {
        setNote("Nobody logged time on that account in this period.");
        return;
      }
      const slug = client
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      downloadCsv(`kijamii-team_${slug}_${from}_to_${to}.csv`, toCsv(shaped.headers, shaped.rows));
      setNote(
        `${shaped.rows.length} ${shaped.rows.length === 1 ? "person" : "people"} on ${client}.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="size-3.5" />
          By client
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] space-y-3 p-3">
        <div className="space-y-1">
          <p className="label-xs">Team on an account</p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Everybody who logged time on one client over the chosen period, with their entity,
            business unit, sub-unit, function and title.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="label-xs-muted w-12 shrink-0">Client</span>
          {loading ? (
            <span className="flex h-8 flex-1 items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading accounts…
            </span>
          ) : (
            <SearchSelect
              className="h-8 flex-1 text-[13px]"
              value={client}
              placeholder="Search for a client"
              emptyText="No account by that name"
              onChange={setClient}
              options={clients.map((name) => ({ id: name, name }))}
            />
          )}
        </div>

        {/* Said plainly rather than left as an empty dropdown somebody pokes
            at wondering whether it is broken. */}
        {!loading && clients.length === 0 && (
          <p className="text-[12px] text-muted-foreground">
            No client has submitted hours in this period. Widen the dates, or clear the market and
            department filters.
          </p>
        )}

        <Button size="sm" className="w-full" disabled={busy || loading || !client} onClick={run}>
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
