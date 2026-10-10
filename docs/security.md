# Kijamii Timesheets — security posture

Owner: Noor Hussam · Last reviewed: 10 October 2026

This describes how the timesheet application protects the data it holds. It is
written to be checked rather than believed: every statement below can be
verified against the database or the repository, and the final section says
how.

## What it holds

Hours logged against accounts, by person, by day. Alongside that, the company
employee list it reads from the OPS sheet: name, work email, business unit,
sub-unit, function, line manager, and assumed team dedication.

It holds **no** salary, no bank details, no national ID, no home address, no
passwords, and no client-confidential material beyond the name of the account a
piece of work was logged against.

## Where it runs

- **Database and authentication** — Supabase (managed PostgreSQL 17), project
  `akiykeotvhyljaesmqaw`. Encrypted at rest and in transit, with automated
  backups and point-in-time recovery provided by the platform.
- **Application** — a static front end on Vercel. It holds no secrets and no
  rule that matters. Every rule is enforced in the database, not in the page.
- **Source** — GitHub, `noorhussamnh-tech/Kijamii-Timesheets`. Every change to
  the schema is a numbered migration file, so the complete history of what
  changed and when is readable by anyone with access to the repository.

## Getting in

Sign-in is **Google only**, restricted to `@kijamii.com`. There is no password
to set, forget, reuse or leak, and no separate account to de-provision: when a
person loses their Google account they lose this at the same moment. Whatever
multi-factor and device policy IT enforces on Google Workspace governs this
application automatically, without it needing to know about it.

A Google account alone is not sufficient. The address must also appear on the
company employee list. Somebody outside it is authenticated but not authorised,
and is told so.

## Who can see what

This is where the protection lives, and it is worth reading closely.

The browser is never trusted. Every read and every write goes through a
database function that re-derives the caller's identity from their signed token
and re-checks their permission before returning anything. Every table beneath
carries row-level security. A person who edits the page in their browser, or
calls the API directly with their own valid token, receives exactly what the
rules below permit and nothing further.

| Who            | Sees                                                       |
| -------------- | ---------------------------------------------------------- |
| An employee    | Their own hours, and nobody else's                         |
| A line manager | Themselves and everyone beneath them in the reporting line |
| An admin       | Everybody                                                  |

Two people hold admin: Noor Hussam and Bahy Aboelezz. Admin is a column in the
database, checked on every privileged call rather than assumed from the screen
somebody is looking at.

Privileged functions — directory synchronisation, reopening a closed week,
changing a person's record — verify the caller is an admin before acting.
Functions that exist for maintenance rather than for the application are not
callable by signed-in accounts at all.

## Integrity of the record

- A week locks a fortnight after it ends. Reopening one is an admin action and
  is logged.
- A day cannot exceed 16 hours.
- A submitted week is stamped with the time it was filed.
- Privileged actions are written to an append-only audit log carrying the
  address of the person who performed them.
- Drafts are excluded from every export: unfinished work does not reach a
  management report.

## Design decisions and their trade-offs

Stated because a posture document that claims no trade-offs is not describing a
real system.

- **A managed database means the provider's staff can technically reach the
  data**, as is true of any managed service including Google Workspace. The
  alternative — self-hosting on a machine nobody is paid to patch — is worse,
  and this is the same judgement the company has already made elsewhere.
- **Two admins see everything.** That is deliberate: somebody has to be able to
  answer whether the company billed a month correctly. It is concentration of
  access and should be reviewed whenever either person changes role.
- **An export is a file.** Once a CSV is on a laptop, this application's
  controls no longer apply to it. That is true of every reporting tool in the
  company and is governed by device policy, which is IT's, rather than by this
  application.
- **No formal penetration test has been commissioned.** Assurance to date is
  automated linting by the platform plus direct inspection of every table,
  function and grant.

## Division of responsibility

The split below is ordinary separation of duties: the team that runs a system
is not the team that audits it.

**IT owns** the Google Workspace identity layer — multi-factor policy,
onboarding, offboarding, device management. All of which already govern this
application, because sign-in is Google.

**IT receives** a standing invitation to review: read access to the repository,
the platform's security linter output on request, and a quarterly review slot.
Any finding IT raises gets a written response and, where valid, a fix carrying
a migration number and a date.

**The product owner retains** database administration, deployment, and the
admin role inside the application.

**Escalation** is to the CEO, who holds the second admin account and can see
everything in the application himself.

## Verifying any of this

- Row-level security and the policies on every table — `pg_policies` and
  `pg_class.relrowsecurity`.
- Who may call which function — `has_function_privilege` for each.
- Every schema change ever made — `supabase/migrations/`, numbered and
  commented.
- Privileged actions taken — the `ts_audit_log` table.
- The platform's own assessment — Supabase dashboard, Advisors → Security.
