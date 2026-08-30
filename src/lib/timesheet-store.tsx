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
import { format } from "date-fns";
import { configs, type TimesheetFormConfig } from "@/data/timesheet-config";
import {
  clientsForVertical,
  currentEmployee,
  getMarket,
  type Employee,
  type MarketId,
} from "@/data/reference";


import { seedEntries, seedSubmissions, thisWeekKey } from "@/data/sample";
import {
  emptyEntry,
  isFutureWeek,
  newRowId,
  shiftWeekKey,
  weekDays,
  type SubmissionStatus,
  type TimesheetEntry,
  type WeekSubmission,
} from "@/data/weeks";

export interface RowIssue {
  rowId: string;
  fields: string[];
  message: string;
}

interface Ctx {
  signedIn: boolean;
  authReady: boolean;
  signIn: () => void;
  signOut: () => void;
  employee: Employee;
  marketId: MarketId;
  setMarketId: (m: MarketId) => void;
  config: TimesheetFormConfig;
  weekKey: string;
  setWeekKey: (k: string) => void;
  goWeek: (delta: number) => void;
  goCurrentWeek: () => void;
  isFuture: boolean;
  entries: TimesheetEntry[];
  entriesFor: (weekKey: string) => TimesheetEntry[];
  submissions: Record<string, WeekSubmission>;
  status: SubmissionStatus;
  readOnly: boolean;
  lastSavedAt?: string | undefined;
  dirty: boolean;
  addRow: (date?: string) => void;
  updateRow: (id: string, patch: Partial<TimesheetEntry>) => void;
  duplicateRow: (id: string) => void;
  deleteRow: (id: string) => void;
  submittedDays: Record<string, string>;
  isDayLocked: (date: string) => boolean;
  submitDay: (date: string) => void;
  visibleDates: string[];
  addDay: () => void;
  copyPreviousDay: () => void;
  copyPreviousWeek: () => void;
  clearUnsaved: () => void;
  saveDraft: () => void;
  submitWeek: () => void;
  reopenDraft: () => void;
  showErrors: boolean;
  setShowErrors: (v: boolean) => void;
  issues: RowIssue[];
  totals: {
    total: number;
    billable: number;
    nonBillable: number;
    expected: number;
    missing: number;
    byDay: { date: string; hours: number; expected: number }[];
  };
  lastSubmission?: { weekKey: string; hours: number; at: string } | undefined;
}

// Cached on globalThis so a hot-module reload (which re-evaluates this file)
// reuses the same context object instead of creating a second identity, which
// would make consumers throw "must be used inside TimesheetProvider".
const globalStore = globalThis as unknown as {
  __kijamiiTimesheetContext?: ReturnType<typeof createContext<Ctx | null>>;
};
const TimesheetContext =
  globalStore.__kijamiiTimesheetContext ??
  (globalStore.__kijamiiTimesheetContext = createContext<Ctx | null>(null));

export function TimesheetProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("kijamii-signed-in") === "1") setSignedIn(true);
    } catch {
      /* storage unavailable */
    }
    setAuthReady(true);
  }, []);
  const [marketId, setMarketId] = useState<MarketId>(currentEmployee.marketId);
  const [weekKey, setWeekKey] = useState(thisWeekKey);
  const [entriesByWeek, setEntriesByWeek] = useState<Record<string, TimesheetEntry[]>>(() =>
    seedEntries(),
  );
  const [savedSnapshot, setSavedSnapshot] = useState<Record<string, string>>({});
  const [submissions, setSubmissions] = useState<Record<string, WeekSubmission>>(() =>
    seedSubmissions(),
  );
  const [submittedDays, setSubmittedDays] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<Ctx["lastSubmission"]>();
  const autosave = useRef<ReturnType<typeof setTimeout>>(undefined);

  const market = getMarket(marketId);
  const config = configs[market.config];
  const entries = useMemo(() => entriesByWeek[weekKey] ?? [], [entriesByWeek, weekKey]);
  const submission = submissions[weekKey];
  const status: SubmissionStatus = submission?.status ?? "draft";
  const readOnly = status === "submitted";
  const isFuture = isFutureWeek(weekKey);

  const serialized = JSON.stringify(entries);
  const dirty = (savedSnapshot[weekKey] ?? serialized) !== serialized;

  const markSaved = useCallback(
    (key: string, rows: TimesheetEntry[]) => {
      setSavedSnapshot((s) => ({ ...s, [key]: JSON.stringify(rows) }));
      setSubmissions((s) => ({
        ...s,
        [key]: {
          weekKey: key,
          status: s[key]?.status ?? "draft",
          submittedAt: s[key]?.submittedAt,
          note: s[key]?.note,
          lastSavedAt: new Date().toISOString(),
        },
      }));
    },
    [],
  );

  // Autosave: represented in the UI via the "Saved" indicator.
  useEffect(() => {
    if (readOnly || !dirty) return;
    clearTimeout(autosave.current);
    autosave.current = setTimeout(() => markSaved(weekKey, entries), 1200);
    return () => clearTimeout(autosave.current);
  }, [serialized, dirty, readOnly, weekKey, entries, markSaved]);

  const mutate = (fn: (rows: TimesheetEntry[]) => TimesheetEntry[]) =>
    setEntriesByWeek((prev) => ({ ...prev, [weekKey]: fn(prev[weekKey] ?? []) }));

  const addRow = (date?: string) => {
    const days = weekDays(weekKey);
    const fallback = format(days[0]!, "yyyy-MM-dd");
    const last = entries[entries.length - 1]?.date;
    mutate((rows) => [...rows, emptyEntry(date ?? last ?? fallback, marketId)]);
  };

  const updateRow = (id: string, patch: Partial<TimesheetEntry>) =>
    mutate((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (typeof next.hours === "number" && next.hours < 0) next.hours = 0;
        return next;
      }),
    );

  const duplicateRow = (id: string) =>
    mutate((rows) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return rows;
      const clone = { ...rows[i]!, id: newRowId() };
      return [...rows.slice(0, i + 1), clone, ...rows.slice(i + 1)];
    });

  const deleteRow = (id: string) => mutate((rows) => rows.filter((r) => r.id !== id));

  const copyPreviousDay = () => {
    if (!entries.length) return;
    const dates = [...new Set(entries.map((r) => r.date))].sort();
    const lastDate = dates[dates.length - 1]!;
    const prevDate = dates[dates.length - 2] ?? lastDate;
    const source = entries.filter((r) => r.date === prevDate);
    const days = weekDays(weekKey).map((d) => format(d, "yyyy-MM-dd"));
    const target = days[Math.min(days.indexOf(lastDate) + (prevDate === lastDate ? 1 : 0), 6)]!;
    mutate((rows) => [
      ...rows,
      ...source.map((r) => ({
        ...r,
        id: newRowId(),
        date: target,
      })),
    ]);
  };

  const copyPreviousWeek = () => {
    const prev = entriesByWeek[shiftWeekKey(weekKey, -1)] ?? [];
    if (!prev.length) return;
    const days = weekDays(weekKey).map((d) => format(d, "yyyy-MM-dd"));
    mutate((rows) => [
      ...rows,
      ...prev.map((r) => {
        const dayIndex = new Date(r.date).getDay();
        return {
          ...r,
          id: newRowId(),
          date: days[dayIndex]!,
        };
      }),
    ]);
  };

  const visibleDates = useMemo(() => {
    const all = weekDays(weekKey).map((d) => format(d, "yyyy-MM-dd"));
    const withRows = new Set(entries.map((r) => r.date));
    const first = all[0]!;
    return all.filter((d) => d === first || withRows.has(d));
  }, [weekKey, entries]);

  const addDay = () => {
    const all = weekDays(weekKey).map((d) => format(d, "yyyy-MM-dd"));
    const next = all.find((d) => !visibleDates.includes(d));
    if (!next) return;
    mutate((rows) => [...rows, emptyEntry(next, marketId)]);
  };

  const isDayLocked = (date: string) => Boolean(submittedDays[date]);

  const submitDay = (date: string) => {
    setSubmittedDays((s) => ({ ...s, [date]: new Date().toISOString() }));
    setShowErrors(false);
  };

  const clearUnsaved = () => {
    const snap = savedSnapshot[weekKey];
    if (!snap) return;
    setEntriesByWeek((prev) => ({ ...prev, [weekKey]: JSON.parse(snap) as TimesheetEntry[] }));
    setShowErrors(false);
  };

  const saveDraft = () => markSaved(weekKey, entries);

  const issues = useMemo<RowIssue[]>(() => {
    const out: RowIssue[] = [];
    const required = config.fields.filter((f) => f.required);
    for (const row of entries) {
      const missing: string[] = [];
      for (const f of required) {
        const v = row[f.key as keyof TimesheetEntry];
        if (f.key === "billable") continue;
        if (f.key === "hours") {
          if (v === "" || v === null || Number(v) <= 0) missing.push("hours");
          else if (Math.round(Number(v) * 100) % 25 !== 0) missing.push("hours");
        } else if (!v) missing.push(f.key);
      }
      if (missing.length) {
        const labels = missing.map(
          (k) => config.fields.find((f) => f.key === k)?.label ?? k,
        );
        out.push({
          rowId: row.id,
          fields: missing,
          message: missing.includes("hours")
            ? `Add ${labels.join(", ")} — hours must be greater than 0 in 0.25 steps.`
            : `Add ${labels.join(", ")} to complete this row.`,
        });
      }
    }
    return out;
  }, [entries, config]);

  const totals = useMemo(() => {
    const num = (v: number | "") => (typeof v === "number" ? v : 0);
    const total = entries.reduce((s, r) => s + num(r.hours), 0);
    const billable = entries.filter((r) => r.billable).reduce((s, r) => s + num(r.hours), 0);
    const byDay = weekDays(weekKey).map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return {
        date: key,
        hours: entries.filter((r) => r.date === key).reduce((s, r) => s + num(r.hours), 0),
        expected: market.workDays.includes(d.getDay()) ? market.expectedDailyHours : 0,
      };
    });
    return {
      total,
      billable,
      nonBillable: total - billable,
      expected: config.expectedWeeklyHours,
      missing: Math.max(0, config.expectedWeeklyHours - total),
      byDay,
    };
  }, [entries, weekKey, market, config]);

  const submitWeek = () => {
    setSubmissions((s) => ({
      ...s,
      [weekKey]: {
        weekKey,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
      },
    }));
    setSavedSnapshot((s) => ({ ...s, [weekKey]: JSON.stringify(entries) }));
    setLastSubmission({ weekKey, hours: totals.total, at: new Date().toISOString() });
    setShowErrors(false);
  };

  const reopenDraft = () =>
    setSubmissions((s) => ({
      ...s,
      [weekKey]: { ...(s[weekKey] ?? { weekKey }), status: "draft" },
    }));

  const value: Ctx = {
    signedIn,
    authReady,
    signIn: () => {
      setSignedIn(true);
      try {
        window.localStorage.setItem("kijamii-signed-in", "1");
      } catch {
        /* storage unavailable */
      }
    },
    signOut: () => {
      setSignedIn(false);
      try {
        window.localStorage.removeItem("kijamii-signed-in");
      } catch {
        /* storage unavailable */
      }
    },
    employee: currentEmployee,
    marketId,
    setMarketId: (m) => {
      setMarketId(m);
      // Stamp the registered vertical on the rows and drop clients that do not
      // belong to the newly selected vertical.
      const allowed = new Set(clientsForVertical(m).map((c) => c.id));
      setEntriesByWeek((prev) => ({
        ...prev,
        [weekKey]: (prev[weekKey] ?? []).map((r) => ({
          ...r,
          verticalId: m,
          clientId: allowed.has(r.clientId) ? r.clientId : "",
          clientOther: allowed.has(r.clientId) ? r.clientOther : "",
        })),
      }));
    },

    config,
    weekKey,
    setWeekKey,
    goWeek: (delta) => setWeekKey((k) => shiftWeekKey(k, delta)),
    goCurrentWeek: () => setWeekKey(thisWeekKey),
    isFuture,
    entries,
    entriesFor: (k) => entriesByWeek[k] ?? [],
    submissions,
    status,
    readOnly,
    lastSavedAt: submission?.lastSavedAt,
    dirty,
    addRow,
    updateRow,
    duplicateRow,
    deleteRow,
    submittedDays,
    isDayLocked,
    submitDay,
    visibleDates,
    addDay,
    copyPreviousDay,
    copyPreviousWeek,
    clearUnsaved,
    saveDraft,
    submitWeek,
    reopenDraft,
    showErrors,
    setShowErrors,
    issues,
    totals,
    lastSubmission,
  };

  return <TimesheetContext.Provider value={value}>{children}</TimesheetContext.Provider>;
}

export function useTimesheet() {
  const ctx = useContext(TimesheetContext);
  if (!ctx) throw new Error("useTimesheet must be used inside TimesheetProvider");
  return ctx;
}
