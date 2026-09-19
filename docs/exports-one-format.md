# One export format, with a picker

**Status: agreed in principle, not built.** Nothing in this document has been
implemented. It is here so the reasoning survives until somebody decides to
act on it.

Written 19 Sep 2026, from a conversation with Noor.

---

## What problem this solves

The admin page had grown fourteen breakdowns, plus Export Entries, plus By
Client, plus By Team, plus Calendar Year View, plus a four-way per-employee
menu. Roughly twenty ways to get a CSV. Nobody could tell which to use, and
there was no way to judge a good view from a bad one — so the count kept
going up.

The idea: **stop having many shapes. Have one shape and a dimension.** The
picker stops being "which report" and becomes the x-axis — the base of the
analysis. Every file then reads the same way: *here are the people in this
slice, described identically, with what they were meant to do and what they
did.*

Two files from different slices stack next to each other. Stakeholders learn
one format once.

---

## The format

Split the columns into two blocks.

### The person block — on every export, no exceptions

```
Name | Email | Entity | Business Unit | Sub Unit | Function | Manager
```

Today these are inconsistent: some exports carry Title, some Market, some
Department, in different orders. Standardising costs nothing and is a pure
win regardless of whether the rest of this happens.

### The measure block

```
Assumed Hours | Assumed % | Actual Hours | Actual %
```

**Actual Hours and Actual % go everywhere.** The denominator is one person's
month, which holds whatever the slice is.

**Assumed Hours and Assumed % appear only when the picker is Team. Blank
everywhere else.** This is the part to hold the line on — see below.

---

## Why Assumed only works for Team

The assumed dedication data is **per person per team**. It does not exist per
client, per manager, per function, or per business unit.

| Picker | Does Assumed mean anything? |
|---|---|
| **Team** | Yes. This is the only one. |
| Manager, Function, Business Unit, Sub Unit | No. It would be 140 × headcount, which is *capacity*, not an assumption about where time goes. |
| Client | No — **not even after the client→team mapping sheet.** The mapping says a client belongs to a team. It does not say how much of that team's plan the client is. If Sports CTFC has five clients, you cannot split someone's 5% team dedication across them without per-client assumptions nobody has made. |
| Day / Week / Month | No. The assumed side is defined per month. |

**Do not fill Assumed with headcount arithmetic to make the columns look
complete.** It would read as a target and isn't one, and it is exactly the
kind of number somebody acts on.

Blank is honest. The layout stays uniform; only the content varies.

---

## The change that makes it work

**Every export becomes one row per person.**

Right now seven of the fourteen breakdowns are aggregates — "By business
unit" gives one line per business unit, not per person. Under this model the
picker becomes a *filter* and the rows are always people.

That is what makes the format uniform and the percentages meaningful. It is
the real change; the column list is the easy part.

---

## What it costs

The aggregate views answer "how many hours did Studio do" in one glance.
Under the new model you get thirty people and sum them yourself.

**Open question, not yet decided:**

> Keep two or three aggregate views, or put a totals row at the bottom of
> every file?

Worth deciding deliberately rather than discovering it in use.

---

## Done: the 140 scales (shipped 19 Sep 2026)

Assumed Hours is currently `assumed % × 140`, with 140 hard-coded as one
month. Today that is safe because the export is run a month at a time.

Under a uniform format with a free date picker, somebody will run a quarter
and get Assumed Hours a third of the truth.

**Decision (Noor, 19 Sep 2026): 140 is per month. Scale it by the number of
months in the selected range.** Built the same day, ahead of the rest of this
document — `ts_months_in_range()` counts the fraction of each calendar month
the range covers and sums it, so a whole month is exactly 1.0 and a quarter
exactly 3.0. Actual % uses the same figure, or a quarter's hours over a
month's capacity would read as 300%.

---

## What survives

- **The standard format, plus a picker.** Replaces most of the fourteen.
- **"Every entry"** — keep. It is the audit trail, and the thing anybody with
  a pivot table rebuilds the others from.
- **"Client split, day by day"** — keep. Genuinely a different shape: a grid
  (clients down, days across), not a list.

Everything else is a candidate for retirement.

---

## Related context worth remembering

- **Adoption is the real constraint.** As of 19 Sep 2026: 133 people are
  expected to log; **two have ever logged anything** — 25 entries, 68.8
  hours, over six weeks. Every export is a window onto almost nothing until
  that changes. No amount of format design substitutes for people logging.
- **Team on an entry is temporary.** Once the client→team mapping sheet
  arrives, team is derived from the account and the Team column comes off the
  timesheet. That also closes two holes: people skipping the field, and
  nothing checking the team belongs to them.
- **Entity** comes from the existing directory, not the OPS sheet's Entity
  column — that one was 38 rows filled out of 270 and contradicted itself for
  eight of the seventeen people who had one. Noor is fixing it at source.
