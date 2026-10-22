# Pilot adoption report

Rebuilds the timesheet adoption page from live data and mails the headline to
Noor each working morning. Three files, no credentials in any of them:

| File | Job |
|---|---|
| `query.sql` | Every figure the page needs, as one JSON object. Entirely date-relative. |
| `render.py` | Turns that JSON into the page. Also writes `headline.json` for the email. |
| `template.html` | The page, with `{{PLACEHOLDER}}` slots. |

## Running it

```
# 1. run query.sql against the timesheet database, save the `payload` column
#    (the JSON object itself, not the row wrapper) to payload.json
# 2. build
python3 scripts/adoption-report/render.py < payload.json > report.html
# 3. publish report.html to the existing artifact, and mail the summary
```

`render.py` reads nothing but stdin and `template.html`, so it holds no database
credentials and runs anywhere Python 3 does. Whoever calls it supplies the
numbers — in the scheduled run that is a Claude session with the Supabase
connector, which is also what keeps the secret out of this repo.

## What the numbers mean

- **The pilot** is the four launch leads — Nadia, Marina, Emad Mutter, Ramy
  Kamel — plus everyone the staff directory lists as reporting to them. Leads
  are matched by email, because the directory writes a manager's full legal name
  while `ts_employees` holds the short one.
- **Utilisation** is hours logged in the current week over the hours available
  in it: 8 × the working days (Sun–Thu) that have *finished*. Today is excluded
  from both sides, so the figure does not collapse every morning. On a Sunday,
  when no day of the week has finished, it falls back to the previous week.
- **A day logged** is a date carrying at least one entry with hours on it.
- Over 100% is real overtime, not a rounding artefact, and is left showing.

## Changing it

The cohort is the `mgrs` list in `query.sql`; add a lead there to widen the
pilot. The team order on the page is `ORDER` in `render.py`. The "save bug
fixed" marker on the chart is the `fixed_on` argument in `render.py`; drop it
once it stops being the explanation for the mid-October dip.
