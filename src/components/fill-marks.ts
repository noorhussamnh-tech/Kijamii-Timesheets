import { AlertCircle, Hourglass, Trophy } from "lucide-react";

import type { FillLevel } from "@/lib/domain/totals";

/**
 * How filled somebody's period is, said in a colour and a shape.
 *
 * Green and a trophy for a period filed in full, amber and an hourglass for
 * one still running, red and an alert for one barely started. A lead scanning
 * fifteen names wants the two who owe them something, and finding those meant
 * reading a number at the other end of every row.
 *
 * The shape is not decoration. Colour alone fails for the one in twelve men
 * who cannot separate red from green, so the icon carries the same meaning
 * independently -- and it is labelled, which a colour never is.
 *
 * Red for barely started rather than the muted grey a status badge uses: grey
 * is how a page says "ignore this", and these are the only people on it
 * anybody has to do something about.
 *
 * Kept apart from the component that draws it so the labels and the colours
 * can be read by a filter, a table and a heading without any of them
 * importing a component to get at a string.
 */
export const MARKS: Record<
  FillLevel,
  { icon: typeof Trophy; text: string; label: string; note: string }
> = {
  full: { icon: Trophy, text: "text-success", label: "Filled in full", note: "100% of the period" },
  partial: {
    icon: Hourglass,
    text: "text-warning",
    label: "Partially filled",
    note: "Half the period or more",
  },
  none: { icon: AlertCircle, text: "text-destructive", label: "Not filled", note: "Under half" },
};

/** The three, in the order a filter offers them. */
export const FILL_LEVELS: FillLevel[] = ["full", "partial", "none"];

/** The colour a name in this state is written in. */
export const fillTextClass = (level: FillLevel): string => MARKS[level].text;

/** What the filter and the labels call each state. */
export const fillLabel = (level: FillLevel): string => MARKS[level].label;

/** The threshold behind the label, so a filter can say where the line is. */
export const fillNote = (level: FillLevel): string => MARKS[level].note;
