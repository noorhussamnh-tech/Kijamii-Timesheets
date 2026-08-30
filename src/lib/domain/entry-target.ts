/**
 * Where a new row should land within a week.
 *
 * Extracted so the rule can be tested directly: it caused two bugs in a row,
 * one placing rows on a locked day and one placing them outside the week
 * entirely, and neither was visible from the UI until someone was stuck.
 */
export function defaultEntryDateFor(focusDate: string, selectableDates: string[]): string | null {
  // Today, when it is part of this week. A day that has already been submitted
  // still accepts new rows, so being locked is no longer a reason to skip it.
  if (selectableDates.includes(focusDate)) return focusDate;
  // Otherwise the latest day *in this week*: a row dated outside the week it is
  // filed under is refused by the database.
  return selectableDates[selectableDates.length - 1] ?? null;
}
