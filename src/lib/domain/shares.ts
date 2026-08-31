/**
 * Hours as shares of a whole.
 *
 * The page deliberately leads with proportions rather than totals: "a third of
 * your month went to one brand" is a fact worth knowing about your own work,
 * where "37.5 hours" mostly invites a comparison with somebody else's number.
 */
import { MAX_SERIES } from "@/lib/viz/palette";

export interface Share {
  name: string;
  hours: number;
  /** 0 to 1. */
  fraction: number;
  /** True for the folded remainder, which is drawn in a neutral grey. */
  isOther: boolean;
}

/**
 * Accounts by share of the period, biggest first, with the tail folded into a
 * single "Other" so the chart never has more slices than it has distinct
 * colours.
 *
 * The fold is honest: "Other" keeps the hours it represents rather than
 * dropping them, so the parts still sum to the whole.
 */
export function accountShares(
  rows: readonly { name: string | null; hours: number }[],
  limit: number = MAX_SERIES,
): Share[] {
  const named = rows
    .map((row) => ({ name: row.name?.trim() || "Unnamed", hours: Number(row.hours) || 0 }))
    .filter((row) => row.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  const total = named.reduce((sum, row) => sum + row.hours, 0);
  if (total <= 0) return [];

  // Folding one account into "Other" would replace its name with a vaguer word
  // for no gain, so the tail is only folded when it holds more than one.
  const shouldFold = named.length > limit;
  const head = shouldFold ? named.slice(0, limit - 1) : named;
  const tail = shouldFold ? named.slice(limit - 1) : [];

  const out: Share[] = head.map((row) => ({
    name: row.name,
    hours: row.hours,
    fraction: row.hours / total,
    isOther: false,
  }));

  if (tail.length > 0) {
    const hours = tail.reduce((sum, row) => sum + row.hours, 0);
    out.push({
      name: `${tail.length} others`,
      hours,
      fraction: hours / total,
      isOther: true,
    });
  }

  return out;
}

/**
 * Percentages that add to exactly 100.
 *
 * Rounding each share on its own routinely lands on 99 or 101, which reads as
 * a bug in a chart that claims to show a whole. The largest remainders absorb
 * the difference.
 */
export function wholePercentages(fractions: readonly number[]): number[] {
  const raw = fractions.map((f) => f * 100);
  const floors = raw.map((value) => Math.floor(value));
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  const out = [...floors];
  for (const { index } of order) {
    if (remaining <= 0) break;
    out[index] = (out[index] ?? 0) + 1;
    remaining -= 1;
  }
  return out;
}
