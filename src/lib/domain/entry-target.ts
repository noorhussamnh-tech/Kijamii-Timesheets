/**
 * Where a new row should land within a week.
 *
 * Extracted so the rule can be tested directly: it caused two bugs in a row,
 * one placing rows on a locked day and one placing them outside the week
 * entirely, and neither was visible from the UI until someone was stuck.
 */
export function defaultEntryDateFor(
  focusDate: string,
  selectableDates: string[],
  isLocked: (date: string) => boolean,
): string | null {
  // Today, when it is part of this week and still open.
  if (selectableDates.includes(focusDate) && !isLocked(focusDate)) return focusDate;
  // Otherwise the latest open day *in this week*: a row dated outside the week
  // it is filed under is refused by the database.
  return [...selectableDates].reverse().find((date) => !isLocked(date)) ?? null;
}
