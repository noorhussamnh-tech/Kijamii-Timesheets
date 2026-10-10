# Kijamii Timesheets — security posture

Last reviewed: 10 October 2026. Owner: Noor Hussam.

This describes how the timesheet application protects the data it holds, what
was found in the most recent review and what was done about it. It is written
to be checked rather than believed: every claim below can be verified against
the database or the repository, and the last section says how.

## What it holds

Hours logged against accounts, by person, by day. Alongside that, the company
employee list it reads from the OPS sheet: name, work email, business unit,
sub-unit, function, line manager, and the assumed team dedication.

It holds **no** salary, no bank details, no national ID, no home address, no
passwords, and no client-confidential material beyond the account name a piece
of work was logged against.

## Where it runs

- **Database and authentication**: Supabase (managed PostgreSQL 17), project
  `akiykeotvhyljaesmqaw`. Encrypted at rest and in transit. Point-in-time
  recovery and automated backups are the provider's.
- **Application**: a static front end deployed on Vercel. It holds no secrets
  and no business logic that matters; every rule is enforced in the database.
- **Source**: GitHub, `noorhussamnh-tech/Kijamii-Timesheets`. Every change to
  the schema is a numbered migration file in that repository, so the full
  history of who changed what is readable by anyone with access.

## Getting in

Sign-in is **Google only**, restricted to `@kijamii.com`. There is no password
to set, forget, reuse or leak, and no separate account to de-provision: a
person who loses their Google account loses this at the same moment. Whatever
multi-factor policy IT enforces on Google applies here automatically and
without this application knowing about it.

A Google account alone is not enough. The address must also appear on the
company employee list; somebody outside it is authenticated but not authorised,
and sees a page saying so.

## Who can see what

This is the part worth reading carefully, because it is where the protection
actually lives.

The browser is never trusted. Every read and write goes through a database
function that re-derives who is calling from their signed token and re-checks
their permission. Every table underneath carries row-level security. A person
editing the page in their browser, or calling the API directly with their own
token, gets exactly what the rules below allow and nothing more.

| Who            | Can see                                                  |
| -------------- | -------------------------------------------------------- |
| An employee    | Their own hours, and nobody else's                       |
| A line manager | Themselves and everyone below them in the reporting line |
| An admin       | Everybody                                                |

Two people hold admin: Noor Hussam and Bahy Aboelezz. The list is a column in
the database and is checked on every privileged call.

Separately: the week locks a fortnight after it ends, a day cannot exceed 16
hours, and a submitted week is recorded with a timestamp. Privileged actions —
directory syncs, reopening a closed week — are written to an append-only audit
log with the address of the person who did it.

## The review of 10 October 2026

Run against the provider's security linter plus a direct inspection of every
table, function and grant. Three findings, all fixed the same day. They are
recorded in migration `0056_hardening_before_the_review.sql`.

**1. Three maintenance functions were callable by any signed-in account.**
The serious one. `ts_apply_directory_import`, `ts_retire_the_market_gate` and
`ts_empty_the_scaffolding` were written to be run once, by hand, during the
October directory load. They ran with elevated privilege, carried no permission
check of their own, and were reachable over the REST API by anybody holding a
valid Kijamii token. One deletes rows; one alters a table. Every other
privileged function in the schema asks "are you an admin?" first — these did
not, because nobody thought about the door they left open.

Execute permission is revoked from every public role. No evidence of use: the
functions were created and called within the same hour by the same operator.

**2. Seven functions had an unpinned schema search path.** On a function that
runs with elevated privilege this is a known privilege-escalation route. All
seven are now pinned, matching the thirty-four that already were.

**3. A diagnostic table was left in the API schema without row-level
security.** `zz_lock_probe`, created while diagnosing a connection problem and
never cleaned up. Empty, and now carries row-level security like every other
table. It should be dropped outright, which is a deliberate action at a console
rather than something done in passing.

Also cleaned up: the October load's staging tables held a second copy of all
153 directory records with no remaining purpose. Emptied. The record of what
was loaded is the migration file.

## Known limitations, stated rather than hidden

- **The provider's own staff** can technically reach the data, as is true of
  any managed database, including Google Workspace. Mitigated by choosing an
  established provider rather than self-hosting on a machine nobody patches.
- **Two admins see everything.** That is the design — somebody has to be able
  to answer "did the company bill this correctly" — but it is concentration of
  access and should be reviewed if either person changes role.
- **Export is a file.** Any admin or manager can download a CSV, and once it is
  on a laptop this application's controls no longer apply. This is true of
  every reporting tool in the company and is managed by the same device policy
  as everything else, not by this application.
- **The provider's linter flags "leaked password protection disabled."** It
  does not apply: there are no passwords here. Noted so the finding is not
  mistaken for an open one.
- **No formal penetration test** has been performed. The review above is
  automated linting plus direct inspection.

## Proposed division of responsibility

The split below is the ordinary separation of duties — the people who run a
system are not the people who audit it — and is offered rather than negotiated.

**IT owns:** the Google Workspace identity layer, including MFA policy,
onboarding and offboarding, and device management. All of which already govern
this application, because sign-in is Google.

**IT receives:** a standing invitation to review. Read access to this
repository, the output of the security linter on request, and a quarterly
review slot. Any finding IT raises gets a written response and, where valid, a
fix with a migration number.

**The product owner retains:** database administration, deployment, and the
admin role inside the application. Handing operational control of a live system
to a second team without a named person accountable for it is how changes get
made that nobody can explain afterwards.

**Escalation:** disagreements go to the CEO, who holds the second admin account
and can see everything in the application himself.

## Verifying any of this

- Row-level security on every table, and the policies: `pg_policies` and
  `pg_class.relrowsecurity` in the database.
- Who can call what: `has_function_privilege` against each function.
- Every schema change ever made: `supabase/migrations/` in the repository,
  numbered and commented.
- Privileged actions taken: the `ts_audit_log` table.
- The provider's own findings: the Supabase dashboard, Advisors → Security.
