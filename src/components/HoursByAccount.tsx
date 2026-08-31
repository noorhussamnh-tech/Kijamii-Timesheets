import { useMemo, useState } from "react";

import { accountShares, wholePercentages } from "@/lib/domain/shares";
import { useTheme } from "@/lib/theme";
import { seriesColor } from "@/lib/viz/palette";

/**
 * Where the period's hours went, as shares rather than totals.
 *
 * Two readings of the same numbers. The stacked band answers "what is my time
 * made of" in one glance; the ranked rows underneath answer "how much went to
 * this one", which a band cannot do once slices get thin.
 *
 * Not a pie or a donut: comparing slices by angle is the thing people are
 * measurably worst at, and these percentages are meant to be compared.
 *
 * Every row carries its own name and figure, so identity never depends on
 * telling two colours apart -- which also covers the light-mode hues that sit
 * below the contrast threshold on white.
 */
export function HoursByAccount({
  rows,
}: {
  rows: readonly { name: string | null; hours: number }[];
}) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [hovered, setHovered] = useState<number | null>(null);

  const shares = useMemo(() => accountShares(rows), [rows]);
  const percentages = useMemo(
    () => wholePercentages(shares.map((share) => share.fraction)),
    [shares],
  );

  if (shares.length === 0) {
    return (
      <section className="rounded-xl border bg-surface p-4 shadow-card">
        <h2 className="text-sm font-bold">Where your hours went</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Nothing logged in this period yet.</p>
      </section>
    );
  }

  // The folded remainder is drawn in a neutral grey rather than given a hue of
  // its own: "5 others" is not an entity, and colouring it like one implies it
  // is comparable to the named accounts above it.
  const colorFor = (index: number) =>
    shares[index]?.isOther
      ? dark
        ? "oklch(0.42 0.01 265)"
        : "oklch(0.78 0.008 255)"
      : seriesColor(index, dark);

  return (
    <section className="rounded-xl border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">Where your hours went</h2>
        <p className="text-[11px] text-muted-foreground">Share of the period</p>
      </div>

      {/* The composition band. A 2px gap between segments keeps two adjacent
          colours from reading as one wide block. */}
      <div className="mt-3 flex h-7 w-full gap-[2px] overflow-hidden rounded-md">
        {shares.map((share, index) => (
          <div
            key={share.name}
            className="h-full transition-opacity first:rounded-l-md last:rounded-r-md"
            style={{
              width: `${share.fraction * 100}%`,
              background: colorFor(index),
              opacity: hovered === null || hovered === index ? 1 : 0.35,
            }}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            title={`${share.name} — ${percentages[index]}%`}
          />
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {shares.map((share, index) => (
          <li
            key={share.name}
            className="flex items-center gap-2.5"
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: colorFor(index) }}
            />
            <span className="min-w-0 flex-1 truncate text-[13px]">{share.name}</span>
            {/* A thin track behind each bar so a 2% share is still a visible
                mark rather than a sliver indistinguishable from nothing. */}
            <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-muted sm:block">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(share.fraction * 100, 2)}%`,
                  background: colorFor(index),
                }}
              />
            </span>
            <span className="num w-11 text-right text-[13px] font-bold tabular-nums">
              {percentages[index]}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
