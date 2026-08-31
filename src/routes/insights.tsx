import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { endOfMonth, endOfQuarter, format, startOfMonth, startOfQuarter, subDays } from "date-fns";
import { AlertCircle, Sparkles } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { Confetti } from "@/components/Confetti";
import { HoursByAccount } from "@/components/HoursByAccount";
import { fetchMyStats } from "@/lib/data/api";
import { milestoneFor, wryLine, type Milestone } from "@/lib/domain/milestones";
import { CATEGORICAL } from "@/lib/viz/palette";
import {
  averageHoursPerEntry,
  averageHoursPerLoggedDay,
  billableShare,
  buildTrivia,
  busiestWeekday,
  workPersonality,
  type PersonalStats,
} from "@/lib/domain/insights";
import { formatHours } from "@/lib/domain/totals";
import { dayLabel, toDateKey } from "@/lib/domain/week";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "My Time — Kijamii Timesheets" },
      {
        name: "description",
        content: "What your own logged hours say about how you spent the period.",
      },
    ],
  }),
  component: InsightsRoute,
});

type Period = "month" | "quarter" | "30days";

const PERIODS: { id: Period; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "30days", label: "Last 30 days" },
];

function rangeFor(period: Period, today: Date): { from: string; to: string } {
  if (period === "quarter") {
    return { from: toDateKey(startOfQuarter(today)), to: toDateKey(endOfQuarter(today)) };
  }
  if (period === "30days") {
    return { from: toDateKey(subDays(today, 29)), to: toDateKey(today) };
  }
  return { from: toDateKey(startOfMonth(today)), to: toDateKey(endOfMonth(today)) };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function InsightsRoute() {
  return (
    <AppShell title="My Time" description="What your hours say about your period">
      <Insights />
    </AppShell>
  );
}

/** A single headline number, sized to be read at a glance. */
function BigStat({
  value,
  label,
  tone = "default",
}: {
  value: string;
  label: string;
  tone?: "default" | "brand";
}) {
  return (
    <div className="rounded-xl border bg-surface p-4 shadow-card">
      <p
        className={cn(
          "num text-3xl leading-none font-extrabold tracking-tight",
          tone === "brand" && "text-brand",
        )}
      >
        {value}
      </p>
      <p className="label-xs mt-2">{label}</p>
    </div>
  );
}

/** Horizontal bars, which read faster than a pie for ranked comparison. */
/**
 * Which milestones this browser has already celebrated.
 *
 * localStorage rather than the database: a celebration is a moment in the
 * interface, not a fact about the person, and it is not worth a column or a
 * round trip. The cost is that a new browser may replay one burst, which is a
 * far smaller failure than never celebrating at all because storage was
 * unavailable.
 */
const SEEN_KEY = "kijamii-milestones-seen";

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [],
    );
  } catch {
    return new Set();
  }
}

/** Returns the milestone to celebrate now, and records it as spent. */
function claimMilestone(stats: PersonalStats): Milestone | null {
  const seen = readSeen();
  const milestone = milestoneFor(stats, seen);
  if (!milestone) return null;
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, milestone.id]));
  } catch {
    // Storage unavailable: show it anyway. A repeated celebration beats none.
  }
  return milestone;
}

function Insights() {
  const { status: authStatus, employee } = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<Milestone | null>(null);

  const range = useMemo(() => rangeFor(period, new Date()), [period]);

  useEffect(() => {
    if (authStatus !== "ready") return;
    let cancelled = false;

    setStats(null);
    setError(null);

    void fetchMyStats(range.from, range.to)
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setCelebrating(claimMilestone(data));
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load your stats.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, range.from, range.to]);

  const periodPicker = (
    <div className="flex flex-wrap gap-1.5">
      {PERIODS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => setPeriod(option.id)}
          aria-pressed={period === option.id}
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors",
            period === option.id
              ? "border-brand bg-brand-soft text-brand"
              : "text-muted-foreground hover:border-border-strong",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  if (error) {
    return (
      <div className="space-y-4">
        {periodPicker}
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-4">
        {periodPicker}
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((cell) => (
            <Skeleton key={cell} className="h-[92px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  const confettiColors = CATEGORICAL.map((slot) => slot.light);
  const personality = workPersonality(stats);
  const trivia = buildTrivia(stats);
  const weekday = busiestWeekday(stats);
  const firstName = employee?.fullName?.split(" ")[0] ?? "there";

  if (stats.entryCount === 0) {
    return (
      <div className="space-y-4">
        {periodPicker}
        <div className="rounded-xl border border-dashed bg-surface px-6 py-16 text-center">
          <Sparkles className="mx-auto size-6 text-brand" />
          <h2 className="mt-3 text-base font-bold">Nothing to show yet, {firstName}</h2>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
            Log a few days and this page fills up with what your time actually looked like — your
            biggest client, your longest day, your streak.
          </p>
          <Button className="mt-5" size="sm" onClick={() => window.location.assign("/timesheet")}>
            Log some hours
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {periodPicker}

      {celebrating && <Confetti fire palette={confettiColors} />}

      {celebrating && (
        <section className="rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 dark:bg-brand-soft/25">
          <p className="text-sm font-bold text-brand">{celebrating.title}</p>
          <p className="mt-0.5 text-[13px] text-foreground/80">{celebrating.line}</p>
        </section>
      )}

      {/* The headline: a light-hearted read on the shape of the period.
          The gradient is drawn from the chart palette rather than from the
          brand accent, so it belongs to the same page as the chart below and
          reads as deliberate in either theme. */}
      <section className="relative overflow-hidden rounded-xl border bg-sidebar p-6 shadow-card">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, #4a3aa7 0%, transparent 70%)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-10 size-56 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #eb6834 0%, transparent 70%)" }}
        />
        <div className="relative">
          <p className="label-xs text-sidebar-foreground/50">
            {format(new Date(range.from), "d MMM")} – {format(new Date(range.to), "d MMM yyyy")}
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-sidebar-accent-foreground">
            {personality.title}
          </h2>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-sidebar-foreground/70">
            {personality.blurb}
          </p>
          <p className="mt-3 max-w-lg border-t border-sidebar-border pt-3 text-[12px] leading-relaxed text-sidebar-foreground/55">
            {personality.description}
          </p>
        </div>
      </section>

      {/* Proportions first. Totals still exist below, deliberately smaller:
          how your time divided up is the useful question, and how many hours
          you sat at a desk is the one that invites a pointless comparison. */}
      <HoursByAccount rows={stats.clients} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BigStat
          value={`${Math.round(billableShare(stats) * 100)}%`}
          label="Billable"
          tone="brand"
        />
        <BigStat value={String(stats.daysLogged)} label="Days logged" />
        <BigStat value={String(stats.distinctClients)} label="Clients touched" />
        <BigStat value={String(stats.longestStreak)} label="Longest streak" />
      </div>

      {trivia.length > 0 && (
        <section className="grid gap-3 md:grid-cols-2">
          {trivia.map((item) => (
            <article key={item.id} className="rounded-xl border bg-surface p-4 shadow-card">
              <p className="truncate text-base font-bold">{item.headline}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{item.detail}</p>
            </article>
          ))}
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-surface p-4 shadow-card">
          <p className="label-xs">Typical day</p>
          <p className="num mt-1 text-lg font-bold">
            {formatHours(averageHoursPerLoggedDay(stats))}
          </p>
        </div>
        <div className="rounded-xl border bg-surface p-4 shadow-card">
          <p className="label-xs">Typical entry</p>
          <p className="num mt-1 text-lg font-bold">{formatHours(averageHoursPerEntry(stats))}</p>
        </div>
        <div className="rounded-xl border bg-surface p-4 shadow-card">
          <p className="label-xs">Busiest weekday</p>
          <p className="mt-1 text-lg font-bold">{weekday === null ? "—" : WEEKDAYS[weekday]}</p>
        </div>
      </section>

      {stats.busiestDay && (
        <p className="text-center text-[12px] text-muted-foreground">
          Your longest day was {dayLabel(stats.busiestDay.date)} at{" "}
          {formatHours(stats.busiestDay.hours)}.
        </p>
      )}

      <p className="text-center text-[12px] italic text-muted-foreground">{wryLine()}</p>

      <p className="text-center text-[11px] text-muted-foreground">
        Only you can see this page. It is built from what you logged yourself.
      </p>
    </div>
  );
}
