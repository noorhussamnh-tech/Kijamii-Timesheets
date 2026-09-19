-- 0025: teams, and the dedication the company assumes for each of them.
--
-- "OPS - Employees List (Noor's Version)" replaces the old employee list as
-- the directory the app reads. It is a different shape: one row per person per
-- team, carrying a Manager and a Dedication %, where the old sheet had one row
-- per person. So it arrives as two things -- the person fields it refreshes on
-- ts_employee_directory, and a new assumed-dedication table underneath.
--
-- Two columns the app depends on are NOT in the new sheet: entity, which
-- decides a person's working week, and position. Those are left exactly as
-- they are. Nobody's market or title changes here, and anybody the new sheet
-- introduces who has no directory row yet arrives without a market and is
-- reported by the sync rather than being given a guessed one.

-- --------------------------------------------------------------- teams

create table if not exists ts_teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists ts_teams_name_key on ts_teams (lower(name));

comment on table ts_teams is
  'The squads the OPS employee list staffs people onto. Reference data.';

insert into ts_teams (name) values
  ('AMCC KSA'),
  ('AMCC REG EG'),
  ('AMCC REG UAE'),
  ('Consumer Insights EGY'),
  ('Consumer Insights KSA'),
  ('Consumer Insights UAE'),
  ('Content Production'),
  ('Entertainment'),
  ('MPB EGY'),
  ('MPB KSA'),
  ('MPB UAE'),
  ('Production EGY'),
  ('Production KSA'),
  ('Production UAE'),
  ('Sports CTA Ahli'),
  ('Sports CTFC')
  on conflict do nothing;

-- ------------------------------------------- the dedication we assume

create table if not exists ts_employee_teams (
  email          text not null,
  team_id        uuid not null references ts_teams (id) on delete restrict,
  dedication_pct numeric(6,2) not null check (dedication_pct >= 0 and dedication_pct <= 100),
  synced_at      timestamptz not null default now(),
  primary key (email, team_id),
  constraint ts_employee_teams_email_is_lower check (email = lower(email))
);

comment on table ts_employee_teams is
  'Assumed dedication per person per team, from the OPS employee list. The '
  'planned side of the plan-versus-actual comparison; actuals come from the '
  'team recorded on each entry.';

alter table ts_employee_teams enable row level security;
alter table ts_teams          enable row level security;

create policy ts_teams_read on ts_teams
  for select to authenticated using (ts_current_employee_id() is not null);

-- A person may read their own staffing; admins read everybody's.
create policy ts_employee_teams_read on ts_employee_teams
  for select to authenticated using (
    ts_is_admin()
    or email = (select lower(e.email) from ts_employees e where e.id = ts_current_employee_id())
  );

-- ------------------------------------------------ the team on an entry

alter table ts_entries add column if not exists team_id uuid references ts_teams (id) on delete restrict;

comment on column ts_entries.team_id is
  'Which team the hour belongs to. Nullable: rows logged before teams existed '
  'have none, and somebody the OPS list staffs onto nothing has none to pick. '
  'Left out of the submit checks for the same reason.';

create index if not exists ts_entries_team_idx on ts_entries (team_id) where team_id is not null;

