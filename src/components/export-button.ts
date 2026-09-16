/**
 * The shared look of the export controls in the admin toolbar.
 *
 * One string rather than five copies of the same class list: they sit next to
 * each other on their own row and read as a set, so a change to one that
 * missed the other four would be immediately visible and quietly wrong.
 *
 * Solid rather than outlined, because on a row of its own the set needs to
 * read as "things that do something" against the filters above it. `primary`
 * rather than a literal black: it is near-black on the light theme, which is
 * what was asked for, and inverts on the dark one -- a hard-coded black button
 * would disappear into a dark background.
 */
export const EXPORT_TRIGGER =
  "h-9 gap-1.5 bg-primary px-3 text-[13px] font-bold text-primary-foreground shadow-card hover:bg-primary/90";

/**
 * Export Entries, which sits on the filter row rather than with the shaped
 * exports below it.
 *
 * It is the only export that hands back exactly what the row above it
 * describes -- the same people, the same period, unfolded -- so it belongs
 * beside the controls that decide that rather than among the ones that
 * reshape it. The brand colour separates it from both the black of those and
 * the green of Sync Directory, which is the one button here that writes.
 */
export const RAW_EXPORT_TRIGGER =
  "h-9 gap-1.5 bg-brand px-3 text-[13px] font-bold text-brand-foreground shadow-card hover:bg-brand/90";
