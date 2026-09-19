import { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, Download, Loader2 } from "lucide-react";

import { SearchSelect } from "@/components/SearchSelect";
import { EXPORT_TRIGGER } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchTeamDedication, type TeamDedicationRow } from "@/lib/data/api";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import { teamRosterView, teamsIn } from "@/lib/export/team-dedication";

/**
 * One team: who is meant to be on it, and who was.
 *
 * A file per team rather than one listing every team, because that is how the
 * question gets asked -- a sheet for Sports CTFC, another for AMCC KSA -- and
 * because the answer usually goes to whoever runs that account and should not
 * be reading the rest of the book.
 *
 * Everybody with any assumed dedication is in it, down to five percent. The
 * person on a team for five percent of their month is exactly who gets
 * forgotten when it is being staffed, so the cut is "any", not "meaningful".
 *
 * Deliberately not narrowed by the page's market and department filters. The
 * list is the whole staffing of one team; half of it, filtered, compares
 * against nothing -- and the assumed side is a plan for the team entire.
 *
 * The rows are fetched once and kept, so picking a second team is a re-fold
 * rather than a second wait.
 */
export function ExportByTeam({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<TeamDedicationRow[] | null>(null);
  const [team, setTeam] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    setTeam("");
    setNote(null);
    void fetchTeamDedication(from, to)
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

  const teams = data ? teamsIn(data) : [];

  const run = () => {
    if (!data || !team || busy) return;
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      const shaped = teamRosterView(data, team);
      if (shaped.rows.length === 0) {
        setNote("Nobody is staffed onto that team.");
        return;
      }
      const slug = team
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      downloadCsv(`kijamii-team_${slug}_${from}_to_${to}.csv`, toCsv(shaped.headers, shaped.rows));
      setNote(
        `${shaped.rows.length} ${shaped.rows.length === 1 ? "person" : "people"} on ${team}.`,
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
        <Button size="sm" className={EXPORT_TRIGGER}>
          <Download className="size-3.5" />
          By Team
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] space-y-3 p-3">
        <div className="space-y-1">
          <p className="label-xs">Who is on one team</p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Everybody with any assumed dedication to a team, down to 5%, with the hours that assumes
            and the hours they actually logged.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="label-xs-muted w-12 shrink-0">Team</span>
          {loading ? (
            <span className="flex h-8 flex-1 items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading teams…
            </span>
          ) : (
            <SearchSelect
              className="h-8 flex-1 text-[13px]"
              value={team}
              placeholder="Search for a team"
              emptyText="No team by that name"
              onChange={setTeam}
              options={teams.map((name) => ({ id: name, name }))}
            />
          )}
        </div>

        {!loading && teams.length === 0 && (
          <p className="text-[12px] text-muted-foreground">
            Nobody is staffed onto a team yet. Run Sync Directory, or check the OPS employee list.
          </p>
        )}

        <Button size="sm" className="w-full" disabled={busy || loading || !team} onClick={run}>
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
