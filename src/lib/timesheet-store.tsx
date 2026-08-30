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
import { calculateTotals, type WeekTotals } from "@/lib/domain/totals";
import { isBlankRow, validateWeek, type RowIssue, type WeekIssue } from "@/lib/domain/validation";
import {
  currentWeekKey,
  isFutureWeek,
  shiftWeek,
  toDateKey,
  weekDates,
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
  readOnly: boolean;
  lockedDays: string[];
  isDayLocked: (date: string) => boolean;

  addRow: (date?: string) => void;
  updateRow: (id: string, patch: Partial<TimesheetEntry>) => void;
  duplicateRow: (id: string) => void;
  deleteRow: (id: string) => void;
  copyPreviousWeek: () => Promise<void>;

  visibleDates: string[];
  /** The day the UI should foreground: today, or the week start. */
  focusDate: string;
  addDay: () => void;

  saveState: SaveState;
  lastSavedAt: string | null;
  saveError: string | null;
  dirty: boolean;
  saveDraft: () => Promise<void>;

  submitting: boolean;
  submitWeek: () => Promise<SubmitOutcome | null>;
  submitDay: (date: string) => Promise<SubmitOutcome | null>;
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
    projectType: "",
    task: "",
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
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [status, setStatus] = useState<SubmissionStatus>("draft");
  const [lockedDays, setLockedDays] = useState<string[]>([]);
  const [extraDates, setExtraDates] = useState<string[]>([]);

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

  const config = configById(employee?.configuration ?? null);
  const expectedWeeklyHours = employee?.expectedWeeklyHours ?? config.expectedWeeklyHours;
  const isFuture = isFutureWeek(weekKey);
  const readOnly = status !== "draft" || isFuture;

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
        setEntries(week.entries);
        setSavedSnapshot(JSON.stringify(week.entries));
        setStatus(week.submission?.status ?? "draft");
        setLockedDays(week.lockedDays);
        setLastSavedAt(week.submission?.updatedAt ?? null);
        revision.current = week.submission?.revision ?? 0;
        setSaveState("idle");
        setSaveError(null);
        setShowErrors(false);
        setExtraDates([]);
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
    if (!ready || loading || readOnly || !dirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist(entriesRef.current);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [serialised, dirty, ready, loading, readOnly, persist]);

  // A tab closing mid-edit should not silently drop work.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty && !readOnly) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, readOnly]);

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
  const focusDate = useMemo(() => {
    const all = weekDates(weekKey);
    const today = toDateKey(new Date());
    return all.includes(today) ? today : all[0]!;
  }, [weekKey]);

  const mutate = useCallback(
    (fn: (rows: TimesheetEntry[]) => TimesheetEntry[]) => {
      if (readOnly) return;
      setEntries((rows) => fn(rows));
    },
    [readOnly],
  );

  const addRow = useCallback(
    (date?: string) => {
      mutate((rows) => [...rows, emptyEntry(date ?? focusDate)]);
    },
    [focusDate, mutate],
  );

  const updateRow = useCallback(
    (id: string, patch: Partial<TimesheetEntry>) => {
      mutate((rows) =>
        rows.map((row) => {
          if (row.id !== id) return row;
          if (isDayLocked(row.workDate)) return row;
          return { ...row, ...patch };
        }),
      );
    },
    [mutate, isDayLocked],
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
      mutate((rows) => rows.filter((row) => row.id !== id || isDayLocked(row.workDate)));
    },
    [mutate, isDayLocked],
  );

  const visibleDates = useMemo(() => {
    const all = weekDates(weekKey);
    const used = new Set(entries.map((row) => row.workDate));
    for (const date of extraDates) used.add(date);
    return all.filter((date) => date === focusDate || used.has(date));
  }, [weekKey, entries, extraDates, focusDate]);

  const addDay = useCallback(() => {
    const next = weekDates(weekKey).find((date) => !visibleDates.includes(date));
    if (next) setExtraDates((dates) => [...dates, next]);
  }, [weekKey, visibleDates]);

  /** Pulls last week's rows in as a fresh draft, remapped onto this week. */
  const copyPreviousWeek = useCallback(async () => {
    if (readOnly) return;
    const previous = shiftWeek(weekKey, -1);
    try {
      const week = await api.fetchWeek(previous);
      const sourceDates = weekDates(previous);
      const targetDates = weekDates(weekKey);
      const copies = week.entries.map<TimesheetEntry>((row) => {
        const index = sourceDates.indexOf(row.workDate);
        return {
          ...row,
          id: newEntryId(),
          workDate: targetDates[index >= 0 ? index : 0]!,
          status: "draft",
        };
      });
      if (copies.length > 0) mutate((current) => [...current, ...copies]);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Could not copy last week's entries.");
    }
  }, [weekKey, readOnly, mutate]);

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

  const runSubmit = useCallback(
    async (scope: string | null): Promise<SubmitOutcome | null> => {
      if (submitting) return null;

      const result = validateWeek(entriesRef.current, weekKey, {
        ...(scope ? { scope } : {}),
      });
      if (!result.ok) {
        setShowErrors(true);
        return null;
      }

      setSubmitting(true);
      try {
        // Flush pending edits first so the server submits what is on screen.
        clearTimeout(saveTimer.current);
        if (JSON.stringify(entriesRef.current) !== savedSnapshot) {
          const ok = await persist(entriesRef.current);
          if (!ok && saveState === "error") return null;
        }

        const response = scope
          ? await api.submitDay(weekKey, scope)
          : await api.submitWeek(weekKey);

        if (response.ok === false) {
          setShowErrors(true);
          setSaveError(response.problems?.[0]?.message ?? "This week is not ready to submit.");
          return null;
        }

        const outcome: SubmitOutcome = {
          ok: true,
          alreadySubmitted: Boolean(response.alreadySubmitted),
          totalHours: response.totalHours ?? totals.total,
          submittedAt: response.submittedAt ?? null,
          weekStart: weekKey,
        };

        if (scope) {
          setLockedDays((days) => (days.includes(scope) ? days : [...days, scope]));
        } else {
          setStatus("submitted");
          setLastSubmission(outcome);
        }
        setShowErrors(false);
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
    },
    [submitting, weekKey, savedSnapshot, persist, saveState, totals.total],
  );

  const submitWeek = useCallback(() => runSubmit(null), [runSubmit]);
  const submitDay = useCallback((date: string) => runSubmit(date), [runSubmit]);

  // ------------------------------------------------------------ context

  const availableClients = useMemo(() => {
    if (!reference || !employee) return [];
    return api.clientsForEmployee(reference.clients, employee.markets);
  }, [reference, employee]);

  const setWeekKey = useCallback((key: WeekKey) => setWeekKeyState(key), []);

  const value = useMemo<TimesheetContextValue>(
    () => ({
      weekKey,
      setWeekKey,
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
      readOnly,
      lockedDays,
      isDayLocked,
      addRow,
      updateRow,
      duplicateRow,
      deleteRow,
      copyPreviousWeek,
      visibleDates,
      focusDate,
      addDay,
      saveState,
      lastSavedAt,
      saveError,
      dirty,
      saveDraft,
      submitting,
      submitWeek,
      submitDay,
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
      readOnly,
      lockedDays,
      isDayLocked,
      addRow,
      updateRow,
      duplicateRow,
      deleteRow,
      copyPreviousWeek,
      visibleDates,
      focusDate,
      addDay,
      saveState,
      lastSavedAt,
      saveError,
      dirty,
      saveDraft,
      submitting,
      submitWeek,
      submitDay,
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
