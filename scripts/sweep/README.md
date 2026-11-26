# The daily sweep

Runs every morning at 08:17 Cairo, about ninety minutes before the adoption
report, so anything it fixes is already fixed by the time the report is built.

    checks.sql   -- one query over the live database, returns a JSON array of findings
    sweep.py     -- cross-checks the report's own payload, reads leave.json, writes the mail

## Why it exists

A scan on 26 November 2026 found four faults that had been running unnoticed,
two of them for over a month:

| What was wrong | How long | Cost |
|---|---|---|
| Two people logging below a lead were outside the cohort rule | since launch | 343 h in no view at all |
| Khaled Khafagy marked on leave while logging | 4 weeks | a working person and his capacity dropped from every headline |
| Weekend hours filtered out of three windows | since launch | 214 h present in one block, absent from three |
| Month-to-date and month-over-month summing the same month differently | 3 days | the page contradicted itself by 100 h |

None of them announced itself. Every one would have been caught on day one by a
query that took under a second to run. That is the whole argument for this
directory.

## What it looks for

`checks.sql` carries the data checks, each tagged `alarm` or `watch`:

- **alarm** — somebody's work is invisible to the report, or the data cannot be
  true: a person logging outside the cohort, an email shared by two people, an
  entry in the future, more than 24 h in a day, a client reference pointing at
  nothing, a submitted row with no submission time, the backfill window closed.
- **watch** — nothing is broken, the data is just unfinished: drafts against a
  closed month, rows saved without hours, entries that cannot be submitted for
  want of a project type, hours booked to a placeholder instead of a client,
  blank Entity in the OPS list.

`sweep.py` adds the checks that can only be made against the built report, and
these are the ones that would have caught the fourth fault above:

- the month-to-date panes and the month-over-month row must sum the same month
  to the same number, and assume the same capacity;
- the months cannot hold more hours than exist in total;
- the like-for-like window must have the same number of elapsed working days as
  the month it is compared against;
- everybody in the cohort has a name, a team and a non-zero capacity.

It also re-reads `leave.json` and flags anybody on it who has logged in the last
ten days. That one is tagged `fix`: the routine is expected to correct it and
commit, not to report it and move on.

## When it mails

Only when there is an `alarm` or a `fix`, plus once a week on Sunday whatever
happens. A sweep that mails every morning is a sweep nobody reads by the second
week; a sweep that is always silent cannot be told apart from one that has
stopped running. The Sunday note is the heartbeat.

## What it will not do

It reads. It never writes to the application database, never runs a migration,
and never submits anybody's draft for them. The only thing it may change is
`leave.json`, and only to take off somebody who is demonstrably at their desk.

## Keeping it honest

The cohort rule in `checks.sql` is a copy of the one in
`../adoption-report/query.sql`. If that rule changes, change it in both — a
stale copy here will confidently report that the report is wrong when it is the
sweep that is out of date.
