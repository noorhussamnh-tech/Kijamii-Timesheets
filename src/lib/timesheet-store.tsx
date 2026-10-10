/**
 * Timesheet state.
 *
 * Rows live in React state while they are being edited and are persisted by a
 * debounced autosave. Three rules matter here:
 *
 *   1. "Saved" is only ever shown after the database confirms a write. A
 *      failed save says so and offers a retry; it never lies.
 *   2. Each save carries an incrementing revision. The database rejects any
 *      revision that is not newer than the one it holds, so a slow request
 *      cannot overwrite newer edits when it finally lands.
 *   3. Edits made while a save is in flight are not lost: the save that
 *      returns compares against what is on screen and reschedules if the two
 *      have diverged.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/lib/auth";
import * as api from "@/lib/data/api";
import { configById, type TimesheetConfig } from "@/lib/domain/config";
import { defaultEntryDateFor } from "@/lib/domain/entry-target";
import { calculateTotals, type WeekTotals } from "@/lib/domain/totals";
import { isBlankRow, validateWeek, type RowIssue, type WeekIssue } from "@/lib/domain/validation";
import {
  currentWeekKey,
  isFutureDate,
  isFutureWeek,
  shiftWeek,
  toDateKey,
  weekDates,
  weekKeyOf,
  parseDateKey,
  type WeekKey,
} from "@/lib/domain/week";
import type {
  ClientOption,
  ReferenceData,
  SubmissionStatus,
  TimesheetEntry,
} from "@/lib/domain/types";

const AUTOSAVE_DEBOUNCE_MS = 1200;

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface SubmitOutcome {
  ok: boolean;
  alreadySubmitted: boolean;
  /** How many rows this press filed, and how many it left behind. */
  filed: number;
  held: number;
  heldDays: string[];
  totalHours: number;
  submittedAt: string | null;
  weekStart: WeekKey;
}

interface TimesheetContextValue {
  weekKey: WeekKey;
  setWeekKey: (key: WeekKey) => void;
  goWeek: (delta: number) => void;
  goCurrentWeek: () => void;
  isFuture: boolean;

  loading: boolean;
  loadError: string | null;
  reload: () => void;

  config: TimesheetConfig;
  reference: ReferenceData | null;
  availableClients: ClientOption[];

  entries: TimesheetEntry[];
  status: SubmissionStatus;
  lockedDays: string[];
  isDayLocked: (date: string) => boolean;

  addRow: (date?: string) => void;
  updateRow: (id: string, patch: Partial<TimesheetEntry>) => void;
  /** Re-dates a row, following it to another week when the date lives there. */
  moveRowToDate: (id: string, date: string) => Promise<void>;
  duplicateRow: (id: string) => void;
  deleteRow: (id: string) => void;

  /**
   * The day on screen. One, always.
   *
   * A week was the unit here because a week is the unit of submission. It is
   * not the unit anybody works in: somebody filling Tuesday in on Wednesday
   * does not want Sunday, Monday, Thursday, Friday and Saturday underneath
   * it. The week is still what loads, and still what submits -- it just no
   * longer decides what the page shows.
   */
  visibleDates: string[];
  /**
   * The seven days of the week on screen: what the Date field offers. Days
   * still to come are included -- a week ahead of today can be filled in.
   */
  selectableDates: string[];
  /** The day being looked at. Everything on screen belongs to it. */
  focusDate: string;
  /** Open a day, whichever week it falls in. */
  setDay: (date: string) => void;
  /** Where a new row lands, or null when this week has no open day. */
  defaultEntryDate: string | null;
  /** Brings a day onto the screen, which now means going to it. */
  addDay: (date: string) => void;

  saveState: SaveState;
  lastSavedAt: string | null;
  saveError: string | null;
  dirty: boolean;
  saveDraft: () => Promise<void>;

  submitting: boolean;
  /**
   * Files every finished row and leaves the rest alone.
   *
   * There is no per-day variant and no refusal. One unfinished row used to
   * block the whole week, which meant four correct days waited on a fifth.
   */
  submitWeek: () => Promise<SubmitOutcome | null>;
  lastSubmission: SubmitOutcome | null;

  showErrors: boolean;
  setShowErrors: (value: boolean) => void;
  rowIssues: RowIssue[];
  weekIssues: WeekIssue[];
  issueFor: (entryId: string) => RowIssue | undefined;

  totals: WeekTotals;
}

const TimesheetContext = createContext<TimesheetContextValue | null>(null);

/** Client-side row identity. Server rows keep the id the database gave them. */
function newEntryId(): string {
  return crypto.randomUUID();
}

function emptyEntry(date: string): TimesheetEntry {
  return {
    id: newEntryId(),
    workDate: date,
    clientId: "",
    clientOther: "",
    serviceId: "",
    teamId: "",
    projectType: "",
    task: "",
    workType: null,
    projectNote: "",
    hours: "",
    billable: true,
    status: "draft",
  };
}

export function TimesheetProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, employee } = useAuth();
  const ready = authStatus === "ready" && employee !== null;

  const [weekKey, setWeekKeyState] = useState<WeekKey>(() => currentWeekKey());
  // The day on screen. The week it belongs to is what gets loaded and saved.
  const [dayKey, setDayKey] = useState<string>(() => toDateKey(new Date()));
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [status, setStatus] = useState<SubmissionStatus>("draft");
  const [lockedDays, setLockedDays] = useState<string[]>([]);

  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<SubmitOutcome | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Serialised snapshot of what the database last confirmed, used to decide
  // whether anything still needs saving.
  const [savedSnapshot, setSavedSnapshot] = useState<string>("[]");

  const revision = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef(false);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  // A row on its way to a different week, inserted once that week loads.
  const pendingInsert = useRef<TimesheetEntry | null>(null);

  const config = configById(employee?.configuration ?? null);
  const expectedWeeklyHours = employee?.expectedWeeklyHours ?? config.expectedWeeklyHours;
  const isFuture = isFutureWeek(weekKey);

  const serialised = useMemo(() => JSON.stringify(entries), [entries]);
  const dirty = serialised !== savedSnapshot;

  // ------------------------------------------------------------- loading

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    void (async () => {
      try {
        const data = await api.fetchReferenceData();
        if (!cancelled) setReference(data);
      } catch (cause) {
        if (!cancelled) {
          setLoadError(
            cause instanceof Error ? cause.message : "Could not load clients and services.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    setLoading(true);
    setLoadError(null);
    clearTimeout(saveTimer.current);

    void (async () => {
      try {
        const week = await api.fetchWeek(weekKey);
        if (cancelled) return;
        const staged = pendingInsert.current;
        const belongsHere = staged && weekKeyOf(parseDateKey(staged.workDate)) === weekKey;
        const loaded = belongsHere && staged ? [...week.entries, staged] : week.entries;
        if (belongsHere) pendingInsert.current = null;

        setEntries(loaded);
        // The staged row is not saved yet, so the snapshot records the week as
        // it arrived. That leaves it dirty, and autosave persists it.
        setSavedSnapshot(JSON.stringify(week.entries));
        setStatus(week.submission?.status ?? "draft");
        setLockedDays(week.lockedDays);
        setLastSavedAt(week.submission?.updatedAt ?? null);
        revision.current = week.submission?.revision ?? 0;
        setSaveState("idle");
        setSaveError(null);
        setShowErrors(false);
      } catch (cause) {
        if (!cancelled) {
          setLoadError(cause instanceof Error ? cause.message : "Could not load this week.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, weekKey, reloadKey]);

  // -------------------------------------------------------------- saving

  const persist = useCallback(
    async (rows: TimesheetEntry[]): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setSaveState("saving");
      setSaveError(null);

      const attempted = JSON.stringify(rows);
      revision.current += 1;

      try {
        // Blank rows are a UI convenience and are not worth a database row.
        const result = await api.saveDraft(
          weekKey,
          rows.filter((row) => !isBlankRow(row)),
          revision.current,
        );

        if (result.stale) {
          // A newer save already landed; this one is simply obsolete.
          revision.current = result.revision;
          return false;
        }

        revision.current = result.revision;
        setLastSavedAt(result.savedAt);
        setSavedSnapshot(attempted);
        // Only claim "Saved" when nothing has changed since this save began.
        setSaveState(JSON.stringify(entriesRef.current) === attempted ? "saved" : "idle");
        return true;
      } catch (cause) {
        setSaveState("error");
        setSaveError(
          cause instanceof api.ApiError
            ? cause.message
            : "Could not save. Your changes are still here — check your connection and retry.",
        );
        return false;
      } finally {
        inFlight.current = false;
      }
    },
    [weekKey],
  );

  // Debounced autosave. Deliberately keyed on the serialised rows so that
  // typing a character at a time produces one request, not one per keystroke.
  useEffect(() => {
    if (!ready || loading || !dirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist(entriesRef.current);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [serialised, dirty, ready, loading, persist]);

  // A tab closing mid-edit should not silently drop work.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const saveDraft = useCallback(async () => {
    clearTimeout(saveTimer.current);
    await persist(entriesRef.current);
  }, [persist]);

  // ------------------------------------------------------------ mutation

  const isDayLocked = useCallback((date: string) => lockedDays.includes(date), [lockedDays]);

  /**
   * The day the screen should open on. Logging time is meant to be a daily
   * habit, so landing on Sunday when it is Wednesday means hunting for today
   * before you can type -- enough friction to lose the habit.
   */
  /**
   * Days in this week that can actually be logged against: everything up to
   * today. Offering tomorrow only to reject it at submit time is a trap, so
   * the future is never selectable in the first place.
   */
  // Every day of the week, with no date withheld: people work weekends, and a
  // day can be filled in whenever suits them.
  const selectableDates = useMemo(() => weekDates(weekKey), [weekKey]);

  /*
   * The day on screen, kept inside the week that is loaded.
   *
   * The clamp matters: a week can change without a day being chosen -- the
   * error reveal does it, and so does anything that jumps -- and a focus day
   * outside the loaded week would show an empty page with no way back.
   */
  const focusDate = useMemo(() => {
    const all = weekDates(weekKey);
    if (all.includes(dayKey)) return dayKey;
    const today = toDateKey(new Date());
    return all.includes(today) ? today : all[0]!;
  }, [weekKey, dayKey]);

  const mutate = useCallback((fn: (rows: TimesheetEntry[]) => TimesheetEntry[]) => {
    setEntries((rows) => fn(rows));
  }, []);

  /**
   * Where a new row lands when no day was named, or null when this week has
   * nowhere to put one.
   *
   * Not simply today: submitting a day locks it, and a row created on a locked
   * day is read-only the instant it appears. The search stays inside the
   * viewed week, because an entry belongs to the week it is filed under and a
   * row dated outside it would be refused by the database.
   *
   * Null is a real answer, not a failure: on the Sunday a week begins, if that
   * Sunday is already submitted then the week genuinely has no day left to log
   * against, and the UI says so rather than producing a dead row.
   */
  const defaultEntryDate = useMemo(
    () => defaultEntryDateFor(focusDate, selectableDates),
    [focusDate, selectableDates],
  );

  const addRow = useCallback(
    (date?: string) => {
      const target = date ?? defaultEntryDate;
      if (!target) return;
      mutate((rows) => [...rows, emptyEntry(target)]);
    },
    [defaultEntryDate, mutate],
  );

  const updateRow = useCallback(
    (id: string, patch: Partial<TimesheetEntry>) => {
      mutate((rows) =>
        rows.map((row) => {
          if (row.id !== id) return row;
          // Status is not a guard. Submitting reports a row; correcting it
          // afterwards is the point, and the database records the amendment.
          return { ...row, ...patch };
        }),
      );
    },
    [mutate],
  );

  /**
   * Re-dates a row, following it to another week if the new date lives there.
   *
   * The database ties an entry to the week it is filed under, so a row cannot
   * simply change date across a week boundary. Instead the current week is
   * saved without it and the row is staged to reappear in the target week.
   */
  const moveRowToDate = useCallback(
    async (id: string, date: string) => {
      const row = entriesRef.current.find((entry) => entry.id === id);
      if (!row) return;

      const targetWeek = weekKeyOf(parseDateKey(date));
      if (targetWeek === weekKey) {
        updateRow(id, { workDate: date });
        return;
      }

      const remaining = entriesRef.current.filter((entry) => entry.id !== id);
      // Persist the removal before leaving, or the row would come back on
      // the next load and exist in two weeks at once.
      clearTimeout(saveTimer.current);
      setEntries(remaining);
      await persist(remaining);

      pendingInsert.current = { ...row, id: newEntryId(), workDate: date, status: "draft" };
      setWeekKeyState(targetWeek);
    },
    [weekKey, updateRow, persist],
  );

  /** Duplicates always get a fresh id, so a copy never overwrites its source. */
  const duplicateRow = useCallback(
    (id: string) => {
      mutate((rows) => {
        const index = rows.findIndex((row) => row.id === id);
        if (index < 0) return rows;
        const copy: TimesheetEntry = {
          ...rows[index]!,
          id: newEntryId(),
          status: "draft",
        };
        return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)];
      });
    },
    [mutate],
  );

  const deleteRow = useCallback(
    (id: string) => {
      mutate((rows) => rows.filter((row) => row.id !== id));
    },
    [mutate],
  );

  /**
   * Which day the grid shows: one.
   *
   * The rest of the week stays loaded and stays saved -- it is simply not
   * drawn, which is the whole of the change.
   */
  const visibleDates = useMemo(() => [focusDate], [focusDate]);

  /**
   * Open a day. Loads whichever week it belongs to if that is not the one
   * already in hand, so a day from three weeks ago is one click, not a week
   * of clicking backwards.
   */
  const setDay = useCallback((date: string) => {
    setDayKey(date);
    const target = weekKeyOf(parseDateKey(date));
    setWeekKeyState((current) => (current === target ? current : target));
  }, []);

  /**
   * Kept because the validator uses it to bring a flagged row onto the screen.
   * With one day shown, revealing a day means going to it.
   */
  const addDay = useCallback(
    (date: string) => {
      if (visibleDates.includes(date)) return;
      setDay(date);
    },
    [visibleDates, setDay],
  );

  // ---------------------------------------------------------- validation

  const validation = useMemo(() => validateWeek(entries, weekKey), [entries, weekKey]);

  const issueFor = useCallback(
    (entryId: string) =>
      showErrors ? validation.rowIssues.find((issue) => issue.entryId === entryId) : undefined,
    [showErrors, validation],
  );

  const totals = useMemo(
    () => calculateTotals(entries, weekKey, config, expectedWeeklyHours),
    [entries, weekKey, config, expectedWeeklyHours],
  );

  // ------------------------------------------------------------- submit

  const submitWeek = useCallback(async (): Promise<SubmitOutcome | null> => {
    if (submitting) return null;
    setSubmitting(true);
    try {
      // Flush pending edits first so the server files what is on screen.
      clearTimeout(saveTimer.current);
      if (JSON.stringify(entriesRef.current) !== savedSnapshot) {
        const ok = await persist(entriesRef.current);
        if (!ok && saveState === "error") return null;
      }

      const response = await api.submitWeek(weekKey);

      const outcome: SubmitOutcome = {
        ok: true,
        alreadySubmitted: Boolean(response.alreadySubmitted),
        filed: response.filed,
        held: response.held,
        heldDays: response.heldDays,
        totalHours: response.totalHours ?? totals.total,
        submittedAt: response.submittedAt ?? null,
        weekStart: weekKey,
      };

      if (outcome.filed > 0) {
        setStatus("submitted");
        setLastSubmission(outcome);
      }
      // The unfinished rows are pointed at rather than complained about: they
      // were not the reason anything failed, because nothing failed.
      setShowErrors(outcome.held > 0);
      setReloadKey((key) => key + 1);
      return outcome;
    } catch (cause) {
      setSaveError(
        cause instanceof api.ApiError ? cause.message : "Could not submit. Please try again.",
      );
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [submitting, weekKey, savedSnapshot, persist, saveState, totals.total]);

  // ------------------------------------------------------------ context

  /*
   * Every active account. The list used to be narrowed by the person's
   * markets, which never narrowed anything -- everybody carries all three --
   * and market is no longer a thing the company is run by.
   */
  const availableClients = useMemo(() => reference?.clients ?? [], [reference]);

  const setWeekKey = useCallback((key: WeekKey) => setWeekKeyState(key), []);

  const value = useMemo<TimesheetContextValue>(
    () => ({
      weekKey,
      setWeekKey,
      setDay,
      goWeek: (delta) => setWeekKeyState((key) => shiftWeek(key, delta)),
      goCurrentWeek: () => setWeekKeyState(currentWeekKey()),
      isFuture,
      loading,
      loadError,
      reload: () => setReloadKey((key) => key + 1),
      config,
      reference,
      availableClients,
      entries,
      status,
      lockedDays,
      isDayLocked,
      addRow,
      updateRow,
      moveRowToDate,
      duplicateRow,
      deleteRow,
      visibleDates,
      selectableDates,
      focusDate,
      defaultEntryDate,
      addDay,
      saveState,
      lastSavedAt,
      saveError,
      dirty,
      saveDraft,
      submitting,
      submitWeek,
      lastSubmission,
      showErrors,
      setShowErrors,
      rowIssues: validation.rowIssues,
      weekIssues: validation.weekIssues,
      issueFor,
      totals,
    }),
    [
      weekKey,
      setWeekKey,
      isFuture,
      loading,
      loadError,
      config,
      reference,
      availableClients,
      entries,
      status,
      lockedDays,
      isDayLocked,
      addRow,
      updateRow,
      moveRowToDate,
      duplicateRow,
      deleteRow,
      visibleDates,
      selectableDates,
      focusDate,
      addDay,
      saveState,
      lastSavedAt,
      saveError,
      dirty,
      saveDraft,
      submitting,
      submitWeek,
      lastSubmission,
      showErrors,
      validation,
      issueFor,
      totals,
    ],
  );

  return <TimesheetContext.Provider value={value}>{children}</TimesheetContext.Provider>;
}

export function useTimesheet(): TimesheetContextValue {
  const ctx = useContext(TimesheetContext);
  if (!ctx) throw new Error("useTimesheet must be used inside TimesheetProvider");
  return ctx;
}
