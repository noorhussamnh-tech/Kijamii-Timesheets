-- Four changes that arrived together.
--
-- 1. Strategy joins the project types.
--
-- 2. Technology and Operations leave the department list; Studio and Sports
--    join it. Deactivated rather than deleted, so anyone already recorded
--    under them keeps a department that still resolves to a name.
--
-- 3. Service stops being asked and starts being derived from the department.
--    That is a real trade: Creative covered Art & Design, Copywriting and
--    Motion, and collapsing it to one value loses that distinction. What it
--    buys is one fewer question asked of seventy people every day. Because
--    the mapping is now one-to-one, Service carries nothing Department does
--    not -- it is kept because existing rows, exports and the job book all
--    read it.
--
-- 4. Scope stops defaulting. An hour is classified deliberately or not at
--    all: a value nobody chose reads as unanswered rather than as a quiet
--    claim that the work was in scope. Drafts may hold unclassified rows;
--    submitting is where the choice is insisted on.

insert into ts_project_types (name, sort_order, active)
values ('Strategy', 35, true)
on conflict do nothing;

update ts_departments set active = false where name in ('Technology', 'Operations');

insert into ts_departments (name, sort_order, active) values
  ('Studio', 80, true),
  ('Sports', 90, true)
on conflict do nothing;

-- The mapping lives in a column rather than in application code, so an admin
-- can correct it without a deploy.
alter table ts_departments
  add column if not exists service_id uuid references ts_services (id) on delete set null;

comment on column ts_departments.service_id is
  'The service stamped on entries logged by this department. Service is no longer chosen per row.';

-- Every department needs something to map to. Four already had an exact
-- service; the rest get one under their own name.
insert into ts_services (name, sort_order, active) values
  ('Creative', 90, true),
  ('Strategy', 100, true),
  ('Entertainment', 110, true),
  ('Studio', 120, true),
  ('Sports', 130, true)
on conflict do nothing;

update ts_departments d
   set service_id = s.id
  from ts_services s
 where lower(s.name) = lower(d.name)
   and d.service_id is null;

alter table ts_entries alter column scope drop default;
alter table ts_entries alter column scope drop not null;

-- ts_save_draft now stamps service_id from the employee's department and
-- stores an unanswered scope as null; ts_validate_week asks for scope instead
-- of the service and task nobody fills in any more. Both were applied as the
-- migrations 'derive_service_from_department' and
-- 'validate_week_scope_not_service'.

-- Applied separately as 'time_dedication_export_markets' and its follow-ups:
-- ts_export_time_dedication gained a p_markets argument defaulting to
-- {EG,UAE}, and the two-argument overload was dropped because a call naming
-- only the dates matched both and Postgres refused to choose. Saudi staff had
-- begun logging hours, which the hard-coded market filter silently dropped.

-- Also applied separately, after Saudi began logging hours and a per-person
-- report was asked for:
--   * 'project_types_and_employee_title' — Master Visual and Greeting
--     deactivated (entries store the type as text, so history still reads);
--     Reels and Digital PR added; ts_employees.title added with an admin-only
--     setter, since a title is assigned by the agency and never self-selected.
--   * 'employee_detail_export' — ts_export_employee_detail returns submitted
--     rows at their finest grain plus the roster, for one employee or all.
--     One function rather than five: total, per-day, per-account and the
--     account-by-day grid are folds of the same rows, so they cannot disagree.

-- Also applied separately, once the job book gained an "Employee Mapping" tab:
--   * 'employee_directory' — ts_employee_directory holds the agency roster
--     (133 people) keyed by email, with a ts_sync_titles_from_directory()
--     that copies Position onto ts_employees.title. Its own table rather than
--     a paste into ts_employees, because most of those people have no account
--     yet and would otherwise arrive untitled.
--   * 'new_accounts_take_title_from_directory' — ts_handle_new_auth_user now
--     reads the title on the way in, so a first sign-in is already titled. It
--     only fills a gap: a title an admin set deliberately is not overwritten.
--
-- Matching is by email, never by name. The sheet holds legal names
-- ("Abdelrahman Hamdy Hassan Mohammed Abo-Elsoud") where the app shows what
-- Google returns, so a name join would miss most of the company.

-- Applied as 'timesheet_exemption' and 'exempt_rosters_in_exports':
--   ts_employees.logs_timesheet marks people who are not expected to keep a
--   timesheet -- the CEO first, and the directory also carries Finance, IT,
--   People & Culture and Legal. Counting any of them as "missing" every week
--   makes the compliance figure lie: two of three submitted reads as a
--   problem when the third was never asked.
--
--   A flag rather than a hard-coded email, because that list grows and nobody
--   should need a deploy to change it. Exempt people keep their accounts and
--   may still log time; they are dropped from ts_admin_week_overview and from
--   the rosters of both exports, never from their own entries. The exemption
--   is about expectation, not erasure.
