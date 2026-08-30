# Kijamii Timesheets

Internal weekly timesheet application for Kijamii teams across Egypt, UAE and
Saudi Arabia. Employees sign in with their Kijamii Google account, log hours
against clients and services, and submit a week for review.

- **Frontend** — TanStack Start (React 19, Vite 8, Tailwind v4, shadcn/ui)
- **Database and auth** — Supabase (Postgres 17 + Supabase Auth, Google provider)
- **Hosting** — Vercel
- **Optional export** — submitted weeks can be appended to a Google Sheet

---

## Table of contents

1. [Local installation](#1-local-installation)
2. [Environment variables](#2-environment-variables)
3. [Google Cloud setup](#3-google-cloud-setup)
4. [Supabase setup](#4-supabase-setup)
5. [Google Sheet setup (optional)](#5-google-sheet-setup-optional)
6. [Authorized redirect URLs](#6-authorized-redirect-urls)
7. [Vercel deployment](#7-vercel-deployment)
8. [Adding or disabling an employee](#8-adding-or-disabling-an-employee)
9. [Updating clients, services and dropdowns](#9-updating-clients-services-and-dropdowns)
10. [How EG_UAE and KSA configurations are maintained](#10-how-eg_uae-and-ksa-configurations-are-maintained)
11. [Verifying a production submission](#11-verifying-a-production-submission)
12. [Deployment checklist](#12-deployment-checklist)
13. [Troubleshooting](#13-troubleshooting)
14. [Architecture notes](#14-architecture-notes)

---

## 1. Local installation

Requires Node.js 22+ (or Bun 1.1+).

```sh
git clone <this-repository-url>
cd Kijamii-Timesheets
npm install            # or: bun install
cp .env.example .env   # then fill in the values from section 2
npm run dev
```

The app runs at <http://localhost:8080>.

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (Nitro, Vercel preset) |
| `npm run lint` | ESLint + Prettier |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | Vitest unit tests |
| `npm run verify` | Lint, typecheck, test and build in sequence |

Run `npm run verify` before pushing; it is the same sequence CI should run.

---

## 2. Environment variables

Copy `.env.example` to `.env`. **Never commit `.env`** — it is gitignored, as
are `*.pem`, `*.key` and `service-account*.json`.

### Required

| Variable | Public? | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | **Yes** | Project URL, e.g. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Yes** | Publishable (`sb_publishable_…`) key |
| `ALLOWED_EMAIL_DOMAINS` | No | Comma-separated, e.g. `kijamii.com` |
| `SEED_ADMIN_EMAILS` | No | Comma-separated addresses granted admin on first sign-in |
| `VITE_SITE_URL` | Yes | Public origin, used to build the OAuth redirect |

> **On the two "public" values.** Anything prefixed `VITE_` is compiled into
> the browser bundle — that is by design. The publishable key grants no access
> on its own: every table it can reach is protected by row-level security, and
> every write goes through a function that re-derives the caller's identity
> from their JWT. Treat it as public, not as a secret.

### Secret — server only

| Variable | Description |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses row-level security. Maintenance scripts only. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account for the Sheets export |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Its private key, newlines written as `\n` |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Target spreadsheet for the export |

**Never prefix a secret with `VITE_`.** That would publish it to every visitor.

---

## 3. Google Cloud setup

Needed so employees can sign in with their Kijamii account.

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and
   create (or select) a project — for example, `kijamii-timesheets`.
2. **APIs & Services → OAuth consent screen**
   - User type: **Internal** (restricts sign-in to your Workspace on Google's
     side as well as ours — belt and braces).
   - App name: `Kijamii Timesheets`. Add a support and developer email.
   - Scopes: the defaults (`email`, `profile`, `openid`) are sufficient.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Add the redirect URI from [section 6](#6-authorized-redirect-urls).
   - Save the **Client ID** and **Client secret** — they go into Supabase, not
     into this repository.
4. For the optional Sheets export only:
   - Enable the **Google Sheets API**.
   - **Create credentials → Service account**, then **Keys → Add key → JSON**.
   - Store the JSON somewhere safe. Copy `client_email` and `private_key` into
     the environment variables above; do not commit the file.

---

## 4. Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (the free tier is
   sufficient for ~70 employees).
2. **Authentication → Providers → Google**: enable it and paste the Client ID
   and Client secret from step 3.
3. **Authentication → URL Configuration**: set the Site URL and Redirect URLs
   per [section 6](#6-authorized-redirect-urls).
4. Apply the migrations in `supabase/migrations/`, in filename order, using the
   SQL editor or the Supabase CLI:

   ```sh
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

5. Configure access control (SQL editor):

   ```sql
   -- Domains allowed to sign in
   update ts_settings
      set value = '["kijamii.com"]'::jsonb, updated_at = now()
    where key = 'allowed_email_domains';

   -- Addresses granted admin on their first sign-in
   update ts_settings
      set value = '["you@kijamii.com"]'::jsonb, updated_at = now()
    where key = 'admin_emails';
   ```

   Set `admin_emails` **before** the first admin signs in. If they already
   signed in, promote them directly:

   ```sql
   update ts_employees set role = 'admin' where email = 'you@kijamii.com';
   ```

---

## 5. Google Sheet setup (optional)

Skip this if you do not need the spreadsheet export; leaving the three Google
variables blank simply disables the feature.

1. Create a spreadsheet with a tab named exactly `Timesheet_Entries`.
2. Add this header row (column order matters — the export appends positionally):

   ```
   entry_id, submission_id, employee_id, employee_name, employee_email, market,
   department, week_start, week_end, work_date, client_id, client_name,
   service_id, service_name, project_type, task_description, hours, notes,
   billing_type, timesheet_configuration, status, created_at, updated_at,
   submitted_at
   ```

3. Share the spreadsheet with the **service account email** as an **Editor**.
   This is the step people miss; without it the export returns a 403.
4. Copy the spreadsheet ID out of its URL into `GOOGLE_SHEETS_SPREADSHEET_ID`:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

The export only ever **appends** submitted rows. It never reads the sheet back
and never updates existing rows, so editing a cell by hand cannot corrupt the
timesheet data — Postgres remains the source of truth.

---

## 6. Authorized redirect URLs

Three places need to agree, and a mismatch is the most common cause of a
failed sign-in.

**Google Cloud → Credentials → your OAuth client → Authorized redirect URIs**

```
https://<your-supabase-ref>.supabase.co/auth/v1/callback
```

That is the *Supabase* callback, not the app's. Google talks to Supabase.

**Supabase → Authentication → URL Configuration**

| Field | Value |
| --- | --- |
| Site URL | `https://timesheets.kijamii.com` (your production origin) |
| Redirect URLs | `https://timesheets.kijamii.com/auth/callback`<br>`http://localhost:8080/auth/callback` |

**The app** builds its redirect from `window.location.origin`, so preview
deployments work if you also add their origins to the Redirect URLs list.

---

## 7. Vercel deployment

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project** and import the repository.
3. Framework preset: **Other**. Build command `npm run build`; leave the output
   directory blank (Nitro writes the Vercel Build Output API format itself).
4. Add every environment variable from section 2 under **Settings →
   Environment Variables**. Secrets go in Production and Preview scopes only.
5. Deploy, then add the deployment origin to Supabase's Redirect URLs.

> **Licensing note.** Vercel's Hobby tier is for non-commercial use. An
> internal company tool normally requires a Pro plan. If that is a problem the
> app also builds for other hosts — set `NITRO_PRESET=netlify` (or another
> Nitro preset) and no code changes are needed.

Security headers (CSP, `X-Frame-Options`, HSTS, `Referrer-Policy`,
`Permissions-Policy`) are applied in `src/lib/security-headers.ts` at the
server entry, so they travel with the app rather than living in host config.

---

## 8. Adding or disabling an employee

**There is no roster to maintain for adding people.** Anyone with a verified
email on an allowed domain gets a timesheet record automatically the first time
they sign in, and chooses their markets and department on a one-time onboarding
screen. New hires need no action at all.

**To remove access**, disable the person's Google Workspace account — that is
the single source of truth and it revokes access everywhere at once.

**To revoke access without touching Workspace:**

```sql
update ts_employees set active = false where email = 'someone@kijamii.com';
```

An inactive employee sees "Your account is not authorized to access Kijamii
Timesheets." and can do nothing else. Their submitted history is retained.

**To correct someone's market, department, hours or role** (markets lock after
onboarding precisely so people cannot reassign themselves):

```sql
select ts_admin_update_employee(
  (select id from ts_employees where email = 'someone@kijamii.com'),
  '{EG,UAE}'::ts_market[],  -- markets they work across
  'EG'::ts_market,          -- primary market: decides their configuration
  'Creative',               -- department
  40,                       -- expected weekly hours
  'employee'::ts_role,      -- or 'admin'
  true                      -- active
);
```

This must be run by a signed-in admin; the service role bypasses it. An admin
cannot demote themselves, so the last admin cannot lock everyone out.

---

## 9. Updating clients, services and dropdowns

All reference data is in the database — nothing is hardcoded in the app, so
none of this needs a deploy. Use the Supabase table editor or SQL.

```sql
-- A new client, available only to the KSA team
insert into ts_clients (client_code, name, sector, markets)
values ('CLI-045', 'New Client', 'Retail', '{KSA}');

-- Available in every market: leave markets empty
insert into ts_clients (client_code, name, markets) values ('CLI-046', 'Global Co', '{}');

-- Retire a client without deleting its history
update ts_clients set active = false where name = 'Old Client';

-- Add a service, a project type or a task
insert into ts_services (service_code, name, sort_order) values ('motion-3d', '3D Motion', 90);
insert into ts_project_types (name, sort_order) values ('Always-On', 80);
insert into ts_task_types (name, sort_order) values ('Storyboard', 150);
```

Setting `active = false` is always preferable to `delete`: existing entries
reference these rows, and deletion is refused by a foreign key.

The `markets` column controls who sees a client. An **empty array means every
market**, which is the deliberate default for clients Prism has no regional
bookings for — nobody is blocked from logging real work.

Clients, sectors and the market mapping were seeded from the Kijamii Prism
database, with the client-to-market mapping derived from Prism's job-book
entries rather than guessed.

---

## 10. How EG_UAE and KSA configurations are maintained

Both configurations live in `src/lib/domain/config.ts`. They currently share an
identical field list; `KSA_CONFIG` exists as a separate object so its columns,
hour rules or working week can diverge without touching Egypt and UAE.

**Which configuration someone gets** is decided by their **primary market**:
`KSA` → `KSA_CONFIG`, everything else → `EG_UAE_CONFIG`. This is set at
onboarding by `ts_complete_onboarding` and mirrored in TypeScript by
`configForMarket`. An employee spanning several markets sees all of their
markets' clients but follows their primary market's configuration.

To give KSA a different field, edit `KSA_CONFIG.fields` only:

```ts
export const KSA_CONFIG: TimesheetConfig = {
  ...
  fields: [...sharedFields, {
    key: "costCenter", label: "Cost Centre", kind: "text",
    required: true, width: "min-w-[150px]",
  }],
};
```

The grid, the mobile card layout and validation all read the field list, so no
component needs changing. A new field that must be stored also needs a column
on `ts_entries` and a line in `ts_save_draft`.

There is deliberately **no Job field** — Kijamii has no job-numbering system.
`ts_entries` keeps `project_type`, `task` and a free-text `project_note`
instead.

---

## 11. Verifying a production submission

After deploying, confirm the whole path end to end:

1. Sign in at the production URL with a Kijamii account.
2. Complete onboarding — pick markets and a department.
3. Add a row: date, client, service, project type, task, hours (e.g. `4.25`).
4. Wait ~2 seconds and confirm the indicator reads **Saved HH:MM**, not
   "Saving…" or "Save failed".
5. Confirm the draft persisted:

   ```sql
   select e.work_date, e.hours, e.status, s.status as week_status
     from ts_entries e join ts_weekly_submissions s on s.id = e.submission_id
    where e.employee_id = (select id from ts_employees where email = 'you@kijamii.com')
    order by e.created_at desc limit 5;
   ```

6. Submit the week, confirm in the dialog, and check the confirmation page
   shows the right total and timestamp.
7. **Confirm no duplicate was created** — this must return exactly one row:

   ```sql
   select week_start, count(*)
     from ts_weekly_submissions
    where employee_id = (select id from ts_employees where email = 'you@kijamii.com')
    group by week_start having count(*) > 1;   -- expect zero rows
   ```

8. Reload the week and confirm it is read-only.
9. Check the audit trail:

   ```sql
   select occurred_at, actor_email, action, details
     from ts_audit_log order by occurred_at desc limit 10;
   ```

10. If the Sheets export is configured, run it as an admin and confirm the rows
    appear in `Timesheet_Entries`.
11. **Clean up the test data** so it does not pollute real reporting:

    ```sql
    delete from ts_weekly_submissions
     where employee_id = (select id from ts_employees where email = 'you@kijamii.com')
       and week_start = '<the test week>';   -- entries cascade
    ```

---

## 12. Deployment checklist

- [ ] Migrations in `supabase/migrations/` applied in order
- [ ] `ts_settings.allowed_email_domains` set to your domain(s)
- [ ] `ts_settings.admin_emails` set **before** the first admin signs in
- [ ] Google OAuth client created; Client ID and secret saved in Supabase
- [ ] OAuth consent screen set to **Internal**
- [ ] Google redirect URI points at the **Supabase** callback
- [ ] Supabase Site URL and Redirect URLs include production and localhost
- [ ] All environment variables set in Vercel; no secret prefixed `VITE_`
- [ ] `npm run verify` passes locally
- [ ] `.env` is not committed (`git check-ignore -v .env`)
- [ ] Production sign-in works with a Kijamii account
- [ ] A non-Kijamii account is refused with the unauthorized message
- [ ] A non-admin cannot load `/admin` data even by typing the URL
- [ ] A real submission verified in the database (section 11)
- [ ] Test data cleaned up

---

## 13. Troubleshooting

**"Your account is not authorized to access Kijamii Timesheets."**
The address authenticated but has no active roster row. Check the domain is in
`allowed_email_domains`; check `select * from ts_employees where email = '…'`.
An `active = false` row produces the same message. Note the trigger only
creates a row when Google reports the address as verified.

**Sign-in redirects back to the sign-in page.**
Almost always a redirect URL mismatch. The app's origin must be in Supabase's
Redirect URLs, and Google's redirect URI must be the *Supabase* callback
(`https://<ref>.supabase.co/auth/v1/callback`), not the app's.

**"Timesheets is not configured".**
`VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` is missing. `VITE_`
variables are baked in at build time, so **redeploy** after adding them —
setting them in Vercel is not enough on its own.

**The admin page says "Admins only".**
`ts_employees.role` is not `admin` for that user. Note the seed list is only
consulted on first sign-in; promote an existing user with SQL (section 4).

**Save failed.**
The indicator never claims success falsely, so this is real. Check the browser
console for the RPC error code. `week_already_submitted` means the week was
submitted in another tab — reload. Otherwise check Supabase is reachable and
the project is not paused (free projects pause after ~a week of inactivity).

**Dropdowns are empty.**
Reference data did not load. Confirm `ts_clients` / `ts_services` have rows and
that the person completed onboarding — the read policies require an onboarded
employee record.

**Export returns "Could not write to the Google Sheet".**
Usually the spreadsheet is not shared with the service account. Share it as an
Editor. Also confirm the Sheets API is enabled and that
`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` has its newlines written as `\n`.

**Build fails on Vercel but works locally.**
Check every environment variable is present in the Vercel scope being built.

---

## 14. Architecture notes

**The database enforces the rules, not the application.** This is the central
design decision and it is what makes the guarantees hold:

| Requirement | How it is guaranteed |
| --- | --- |
| No duplicate weekly submission | `UNIQUE (employee_id, week_start)` |
| Quarter-hour increments, ≤ 24h | `CHECK` constraints on `ts_entries` |
| An entry belongs to its week | Composite foreign key on `(submission_id, week_start)` |
| Employees see only their own rows | Row-level security on every table |
| Submitted work is not editable | RLS policies exclude non-draft rows |
| Admin routes are not reachable by URL | Every admin function re-checks the role in SQL |
| A week submits atomically | `ts_submit_week` is one transaction |

A bug in the frontend therefore cannot create a duplicate submission, expose a
colleague's timesheet, or edit a submitted week — the database refuses.

**Autosave is honest.** Each save carries an incrementing revision that the
database rejects if it is not newer, so a slow request cannot overwrite newer
edits. "Saved" is shown only after a confirmed write; a failure says so and
offers a retry.

**Submission is idempotent.** `ts_submit_week` on an already-submitted week
returns the existing record — same ID, same timestamp — rather than writing a
second one. A double click, a retried request and a duplicated tab all converge
on one record.

**Where the code lives**

```
src/lib/domain/      Framework-free logic: week maths, validation, totals, configs
src/lib/data/        Typed wrappers over the database functions
src/lib/supabase/    Client construction
src/lib/sheets/      Google Sheets export and formula-injection escaping
src/lib/server/      The one operation that needs a server: the Sheets export
src/components/      UI, unchanged in layout from the approved design
supabase/migrations/ Schema, RLS policies and functions, applied in order
```

**Row-level security is live on the app's own queries.** The browser holds only
the signed-in user's access token, so policies apply to every read and write
the app makes. The service role key is not used by the running application at
all.
