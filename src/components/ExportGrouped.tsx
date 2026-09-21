import { useState } from "react";
import { AlertCircle, ChevronDown, Download, Loader2 } from "lucide-react";

import { EXPORT_TRIGGER } from "@/components/export-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchEmployeeDetail, fetchTeamDedication, type ReadScope } from "@/lib/data/api";
import { downloadCsv, toCsv } from "@/lib/export/csv";
import { teamDedicationView } from "@/lib/export/team-dedication";
import { VIEW_GROUPS, type ExportView } from "@/lib/export/views";
import { cn } from "@/lib/utils";

/**
 * Everybody's hours over the chosen period, grouped however the question
 * needs them.
 *
 * This replaces the per-person panel that used to sit beside it. Once that
 * panel's employee picker went -- redundant, because every row of the table
 * has its own Export button, which is the better door for one person since
 * you click the name you are already looking at -- the two controls made the
 * same call with the same views and the same filters. Two buttons doing one
 * thing is worse than either of them.
 *
 * What the panel had and this did not, it has now: a line under each view
 * saying what the file contains, and a count of how many people are actually
 * in it.
 */
export function ExportGrouped({
  from,
  to,
  department,
  manager,
  team,
  dedication = true,
  scope = "company",
}: {
  from: string;
  to: string;
  /** The page's own filters. "all" means unfiltered. */
  department: string;
  manager: string;
  team: string;
  /**
   * Whose rows the file is drawn from. The page decides; the database
   * enforces it.
   */
  scope?: ReadScope;
  /**
   * Whether to offer the plan-against-actual file. Off for a manager: the
   * staffing plan is the whole company's, the database will not hand a
   * fraction of it to anybody but an admin, and an item that always fails is
   * worse than an item that is not there.
   */
  dedication?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (view: ExportView) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      const data = await fetchEmployeeDetail(from, to, null, scope);

      /*
       * The file matches what the page is showing rather than quietly
       * including the people the filters excluded.
       *
       * One predicate, over people, and the rows follow whoever it keeps.
       * Team has to work this way -- a person is on several teams, so
       * "is on this team" is a fact about them, not about the hour -- and
       * running the other two the same way means the roster and the rows
       * cannot disagree about who is in the file.
       */
      const keep = (person: (typeof data.employees)[number]) =>
        (department === "all" || person.department === department) &&
        (manager === "all" || person.manager === manager) &&
        (team === "all" || person.teams.includes(team));

      const employees = data.employees.filter(keep);
      const ids = new Set(employees.map((person) => person.id));
      const narrowed = {
        ...data,
        employees,
        rows: data.rows.filter((row) => ids.has(row.employeeId)),
      };

      const shaped = view.shape(narrowed);
      if (shaped.rows.length === 0) {
        setNote("Nothing submitted in that period.");
        return;
      }

      downloadCsv(`kijamii_${view.id}_${from}_to_${to}.csv`, toCsv(shaped.headers, shaped.rows));
      setNote(`${shaped.rows.length} row${shaped.rows.length === 1 ? "" : "s"} downloaded.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export failed.");
    } finally {
      setBusy(false);
    }
  };

  /*
   * The dedication comparison does not fold out of the detail export like
   * every other view here, so it gets its own runner rather than being bent
   * into the ExportView shape. It ignores the department filter
   * on purpose: it is the whole staffing plan against the whole of what was
   * logged, and a half-filtered plan compares against nothing meaningful.
   */
  const runDedication = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      const shaped = teamDedicationView(await fetchTeamDedication(from, to));
      if (shaped.rows.length === 0) {
        setNote("Nobody is staffed onto a team yet.");
        return;
      }
      downloadCsv(
        `kijamii_assumed-vs-actual_${from}_to_${to}.csv`,
        toCsv(shaped.headers, shaped.rows),
      );
      setNote(`${shaped.rows.length} rows downloaded.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className={EXPORT_TRIGGER} disabled={busy}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Breakdowns
            <ChevronDown className="size-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {VIEW_GROUPS.map((group, index) => (
            <div key={group.label}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="label-xs">{group.label}</DropdownMenuLabel>
              {group.views.map((view) => (
                <DropdownMenuItem
                  key={view.id}
                  onClick={() => void run(view)}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="font-medium">{view.label}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    {view.note}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          ))}
          {dedication && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="label-xs">Plan against actual</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => void runDedication()}
                className="flex-col items-start gap-0.5"
              >
                <span className="font-medium">Assumed vs actual dedication</span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  The OPS list&rsquo;s own columns, with each team&rsquo;s real share beside the
                  assumed one.
                </span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {(note ?? error) && (
        <span
          className={cn(
            "absolute top-full left-0 mt-0.5 inline-flex items-center gap-1 leading-none whitespace-nowrap text-[11px]",
            error ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {error && <AlertCircle className="size-3" />}
          {error ?? note}
        </span>
      )}
    </div>
  );
}
