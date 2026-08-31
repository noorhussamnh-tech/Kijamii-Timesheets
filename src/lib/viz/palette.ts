/**
 * Categorical colours for charts.
 *
 * Kijamii's design tokens carry one brand accent, which is the right answer for
 * buttons and the wrong one for a chart that has to tell seven accounts apart.
 * This is a separate, validated categorical set: eight hues in a fixed order,
 * with a second set of steps chosen for the dark surface rather than flipped
 * from the light one.
 *
 * The order is the accessibility mechanism, not decoration -- it is what keeps
 * adjacent slices distinguishable to colour-blind readers, so slots are
 * assigned in sequence and never shuffled or cycled. Verified against both
 * surfaces: worst adjacent pair 9.1 (light) / 8.4 (dark) on the CVD measure,
 * against a target of 8.
 *
 * Three light-mode hues sit under 3:1 contrast on white, which is allowed only
 * where every value carries a visible label. The chart labels each account
 * directly, so identity never rests on colour alone.
 */
export const CATEGORICAL = [
  { light: "#2a78d6", dark: "#3987e5" }, // blue
  { light: "#eb6834", dark: "#d95926" }, // orange
  { light: "#1baf7a", dark: "#199e70" }, // aqua
  { light: "#eda100", dark: "#c98500" }, // yellow
  { light: "#e87ba4", dark: "#d55181" }, // magenta
  { light: "#008300", dark: "#008300" }, // green
  { light: "#4a3aa7", dark: "#9085e9" }, // violet
  { light: "#e34948", dark: "#e66767" }, // red
] as const;

/**
 * How many accounts get their own colour before the rest fold into "Other".
 *
 * Past this the palette would have to invent hues, and a chart with a dozen
 * near-identical slices answers no question anybody asked.
 */
export const MAX_SERIES = 7;

/** The slot for a series, by its position. Never cycles past the palette. */
export function seriesColor(index: number, dark: boolean): string {
  const slot = CATEGORICAL[Math.min(index, CATEGORICAL.length - 1)]!;
  return dark ? slot.dark : slot.light;
}

/**
 * A hue per work personality, so the card is recognisably *yours* rather than
 * the same slab of brand colour for everyone.
 *
 * Fixed per personality, never assigned by rank or in the order results
 * arrive: the point is that "The Devoted" looks the same every time you see
 * it, the way a team colour does.
 */
export const PERSONALITY_COLORS: Record<string, { light: string; dark: string }> = {
  unwritten: { light: "#4a3aa7", dark: "#9085e9" }, // violet — nothing written yet
  devoted: { light: "#2a78d6", dark: "#3987e5" }, // blue — depth
  juggler: { light: "#eb6834", dark: "#d95926" }, // orange — motion
  "deep-worker": { light: "#1baf7a", dark: "#199e70" }, // aqua — long calm blocks
  sprinter: { light: "#eda100", dark: "#c98500" }, // yellow — speed
  metronome: { light: "#008300", dark: "#008300" }, // green — steady growth
  polymath: { light: "#e87ba4", dark: "#d55181" }, // magenta — variety
  focused: { light: "#e34948", dark: "#e66767" }, // red — single point
  steady: { light: "#2a78d6", dark: "#3987e5" },
};

export function personalityColor(id: string, dark: boolean): string {
  const slot = PERSONALITY_COLORS[id] ?? PERSONALITY_COLORS["steady"]!;
  return dark ? slot.dark : slot.light;
}
