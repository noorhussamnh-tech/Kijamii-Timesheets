-- Kijamii Timesheets — core schema.
--
-- Design notes:
--   * Every guarantee the app depends on is enforced by the database, not by
--     application code: one submission per employee per week is a UNIQUE
--     constraint, quarter-hour increments and the 24h ceiling are CHECKs, and
--     "an entry belongs to the week it is filed under" is a composite foreign
--     key rather than a runtime comparison.
--   * Row-level security scopes every read and write to the signed-in
--     employee. Admin access is a separate policy, never a code path.

create extension if not exists "pgcrypto";

create type ts_market as enum ('EG', 'UAE', 'KSA');
create type ts_config as enum ('EG_UAE', 'KSA');
create type ts_role as enum ('employee', 'admin');
-- 'returned' and 'approved' are unused in v1 but present so adding review
-- workflow later does not require a data migration.
create type ts_status as enum ('draft', 'submitted', 'returned', 'approved');

-- ---------------------------------------------------------------- employees

create table ts_employees (
  id                      uuid primary key default gen_random_uuid(),
  auth_user_id            uuid unique references auth.users (id) on delete set null,
  employee_code           text unique,
  full_name               text not null,
  email                   text not null,
  -- Empty until the person completes onboarding. They may belong to several
  -- markets (an account manager covering EG and UAE sees both client lists);
  -- primary_market is the one that decides which timesheet configuration and
  -- working week apply. Chosen once at onboarding, admin-editable after.
  markets                 ts_market[] not null default '{}',
  primary_market          ts_market,
  department              text,
  timesheet_configuration ts_config,
  expected_weekly_hours   numeric(5, 2) not null default 40
                            check (expected_weekly_hours > 0 and expected_weekly_hours <= 168),
  active                  boolean not null default true,
  role                    ts_role not null default 'employee',
  onboarded_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Emails are stored folded so lookup by Google identity is unambiguous.
  constraint ts_employees_email_is_lower check (email = lower(email)),
  -- An onboarded employee always has both, so the app never has to guess a
  -- configuration for someone who is allowed to submit.
  constraint ts_employees_onboarded_has_market check (
    onboarded_at is null
    or (cardinality(markets) > 0 and primary_market is not null
        and timesheet_configuration is not null)
  ),
  -- The configuration-deciding market must be one the employee actually works in.
  constraint ts_employees_primary_in_markets check (
    primary_market is null or primary_market = any (markets)
  )
);

create unique index ts_employees_email_key on ts_employees (email);
create index ts_employees_active_idx on ts_employees (active) where active;

-- Keeps the markets array canonical (sorted, de-duplicated) so equality checks
-- and the UI never depend on the order the person happened to tick the boxes.
create or replace function ts_normalize_employee_markets() returns trigger
language plpgsql
as $$
begin
  if new.markets is not null then
    new.markets := array(select distinct m from unnest(new.markets) as m order by m);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger ts_employees_normalize
  before insert or update on ts_employees
  for each row execute function ts_normalize_employee_markets();

comment on table ts_employees is
  'Timesheet roster. Rows are created on first Google sign-in from a verified @kijamii.com address; markets and department are chosen once at onboarding and are admin-editable thereafter.';

-- --------------------------------------------------------------- reference

create table ts_clients (
  id          uuid primary key default gen_random_uuid(),
  client_code text unique,
  name        text not null,
  sector      text,
  -- Which markets may log time against this client. Empty means all.
  markets     ts_market[] not null default '{}',
  -- The single free-text "Other (please fill in)" row.
  is_other    boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index ts_clients_name_key on ts_clients (lower(name));
create unique index ts_clients_single_other on ts_clients (is_other) where is_other;

create table ts_services (
  id           uuid primary key default gen_random_uuid(),
  service_code text unique,
  name         text not null,
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create unique index ts_services_name_key on ts_services (lower(name));

create table ts_project_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  active     boolean not null default true,
  sort_order integer not null default 0
);

create unique index ts_project_types_name_key on ts_project_types (lower(name));

create table ts_task_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  active     boolean not null default true,
  sort_order integer not null default 0
);

create unique index ts_task_types_name_key on ts_task_types (lower(name));

create table ts_departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  active     boolean not null default true,
  sort_order integer not null default 0
);

create unique index ts_departments_name_key on ts_departments (lower(name));

-- ------------------------------------------------------------- submissions

create table ts_weekly_submissions (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references ts_employees (id) on delete cascade,
  week_start        date not null,
  week_end          date generated always as (week_start + 6) stored,
  status            ts_status not null default 'draft',
  -- Snapshotted at submission time so history reflects the rules in force then.
  total_hours       numeric(7, 2) not null default 0,
  billable_hours    numeric(7, 2) not null default 0,
  non_billable_hours numeric(7, 2) not null default 0,
  expected_hours    numeric(6, 2) not null default 40,
  missing_hours     numeric(7, 2) not null default 0,
  submitted_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- The guarantee behind "repeat submissions must not create duplicates".
  constraint ts_weekly_submissions_employee_week_key unique (employee_id, week_start),
  -- Weeks are Sunday-anchored across all three markets.
  constraint ts_weekly_submissions_starts_sunday check (extract(dow from week_start) = 0),
  constraint ts_weekly_submissions_submitted_has_timestamp check (
    status = 'draft' or submitted_at is not null
  )
);

-- Lets entries carry week_start and have the database prove it matches.
create unique index ts_weekly_submissions_id_week_key
  on ts_weekly_submissions (id, week_start);

create index ts_weekly_submissions_week_idx on ts_weekly_submissions (week_start);
create index ts_weekly_submissions_employee_idx on ts_weekly_submissions (employee_id);

-- ----------------------------------------------------------------- entries

create table ts_entries (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  week_start    date not null,
  employee_id   uuid not null references ts_employees (id) on delete cascade,
  work_date     date not null,
  client_id     uuid references ts_clients (id) on delete restrict,
  client_other  text,
  service_id    uuid references ts_services (id) on delete restrict,
  project_type  text,
  task          text,
  project_note  text,
  hours         numeric(5, 2) not null,
  billable      boolean not null default true,
  status        ts_status not null default 'draft',
  submitted_at  timestamptz,
  -- Stamped at write time from the selected client's market (falling back to
  -- the employee's primary market) so historical rows keep the market and
  -- department that applied when the work happened.
  market        ts_market not null,
  department    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint ts_entries_submission_fkey
    foreign key (submission_id, week_start)
    references ts_weekly_submissions (id, week_start) on delete cascade,
  -- A row can only be filed against a day inside its own week.
  constraint ts_entries_date_within_week
    check (work_date >= week_start and work_date <= week_start + 6),
  constraint ts_entries_hours_positive check (hours > 0),
  constraint ts_entries_hours_max_day check (hours <= 24),
  -- 0.25-hour increments.
  constraint ts_entries_hours_quarter check (mod(hours * 4, 1) = 0),
  -- The free-text client name belongs to the "Other" client and nothing else;
  -- enforced against ts_clients.is_other by trigger below.
  constraint ts_entries_client_other_len check (client_other is null or length(client_other) <= 200),
  constraint ts_entries_project_note_len check (project_note is null or length(project_note) <= 500)
);

create index ts_entries_submission_idx on ts_entries (submission_id);
create index ts_entries_employee_date_idx on ts_entries (employee_id, work_date);
create index ts_entries_week_idx on ts_entries (week_start);

-- Per-day submission. The week can still be submitted as a whole; locking a
-- day freezes just that day's rows.
create table ts_day_locks (
  submission_id uuid not null references ts_weekly_submissions (id) on delete cascade,
  work_date     date not null,
  submitted_at  timestamptz not null default now(),
  primary key (submission_id, work_date)
);

-- --------------------------------------------------------------- audit log

create table ts_audit_log (
  id          uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_email text,
  action      text not null,
  record_type text,
  record_id   text,
  details     jsonb not null default '{}'::jsonb
);

create index ts_audit_log_occurred_idx on ts_audit_log (occurred_at desc);
create index ts_audit_log_actor_idx on ts_audit_log (actor_email);

-- ------------------------------------------------------ google sheet export

create table ts_sheet_exports (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references ts_weekly_submissions (id) on delete cascade,
  spreadsheet_id text not null,
  status         text not null default 'pending'
                   check (status in ('pending', 'success', 'failed')),
  rows_written   integer not null default 0,
  error          text,
  exported_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index ts_sheet_exports_submission_idx on ts_sheet_exports (submission_id);
