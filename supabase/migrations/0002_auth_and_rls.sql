-- Authorization: domain-gated onboarding plus row-level security.
--
-- The security model has two layers and the app depends on the lower one:
--   1. Server code resolves the caller and refuses unauthorized requests.
--   2. Row-level security scopes every statement to the caller's own rows,
--      so a bug in layer 1 still cannot expose another employee's timesheet.
--
-- Server functions talk to Postgres with the *user's* JWT, never the service
-- role, so these policies are live on every read and write the app makes.

create table ts_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table ts_settings is
  'Runtime configuration that must be changeable without a deploy. Never client-writable.';

insert into ts_settings (key, value) values
  ('allowed_email_domains', '["kijamii.com"]'::jsonb),
  -- Seeded from the SEED_ADMIN_EMAILS environment variable at deploy time.
  ('admin_emails', '[]'::jsonb);

-- ------------------------------------------------------------- helper funcs

-- Resolves the calling auth user to a timesheet employee. Marked STABLE so a
-- single statement evaluates it once rather than per row.
create or replace function ts_current_employee_id() returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select id from ts_employees where auth_user_id = auth.uid() and active
$$;

create or replace function ts_is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(
    (select role = 'admin' from ts_employees where auth_user_id = auth.uid() and active),
    false
  )
$$;

create or replace function ts_email_domain_allowed(addr text) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from ts_settings s,
         jsonb_array_elements_text(s.value) as d(domain)
    where s.key = 'allowed_email_domains'
      and lower(split_part(addr, '@', 2)) = lower(d.domain)
  )
$$;

-- ------------------------------------------------------------ auto-onboard

-- Creates the timesheet roster row the first time somebody signs in with
-- Google. Only verified addresses on an allowed domain get a row; everyone
-- else authenticates fine but has no employee record, which the app surfaces
-- as "not authorized" rather than as an error.
create or replace function ts_handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  addr      text := lower(coalesce(new.email, ''));
  verified  boolean := coalesce((new.raw_user_meta_data ->> 'email_verified')::boolean, false);
  display   text := coalesce(
                nullif(new.raw_user_meta_data ->> 'full_name', ''),
                nullif(new.raw_user_meta_data ->> 'name', ''),
                split_part(addr, '@', 1));
  is_seed_admin boolean;
begin
  if addr = '' or not verified or not ts_email_domain_allowed(addr) then
    return new;
  end if;

  select exists (
    select 1
    from ts_settings s, jsonb_array_elements_text(s.value) as e(email)
    where s.key = 'admin_emails' and lower(e.email) = addr
  ) into is_seed_admin;

  insert into ts_employees (auth_user_id, full_name, email, role)
  values (new.id, display, addr,
          (case when is_seed_admin then 'admin' else 'employee' end)::ts_role)
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        full_name    = case
                         when ts_employees.full_name is null or ts_employees.full_name = ''
                         then excluded.full_name else ts_employees.full_name
                       end,
        updated_at   = now();

  return new;
end;
$$;

create trigger ts_on_auth_user_created
  after insert on auth.users
  for each row execute function ts_handle_new_auth_user();

-- ---------------------------------------------------------------- policies

alter table ts_employees          enable row level security;
alter table ts_clients            enable row level security;
alter table ts_services           enable row level security;
alter table ts_project_types      enable row level security;
alter table ts_task_types         enable row level security;
alter table ts_departments        enable row level security;
alter table ts_weekly_submissions enable row level security;
alter table ts_entries            enable row level security;
alter table ts_day_locks          enable row level security;
alter table ts_audit_log          enable row level security;
alter table ts_sheet_exports      enable row level security;
alter table ts_settings           enable row level security;

-- ts_settings and ts_audit_log carry no policies for regular users at all,
-- so RLS denies everything; only the service role and SECURITY DEFINER
-- functions can reach them.
create policy ts_audit_log_admin_read on ts_audit_log
  for select to authenticated using (ts_is_admin());

-- Employees: you can always read yourself. Admins read everyone. Nobody
-- updates this table directly -- onboarding and admin edits go through
-- SECURITY DEFINER functions, so an employee cannot grant themselves the
-- admin role or move themselves to another market.
create policy ts_employees_read_self on ts_employees
  for select to authenticated
  using (auth_user_id = auth.uid() or ts_is_admin());

-- Reference data is readable by any onboarded employee.
create policy ts_clients_read on ts_clients
  for select to authenticated using (ts_current_employee_id() is not null);
create policy ts_services_read on ts_services
  for select to authenticated using (ts_current_employee_id() is not null);
create policy ts_project_types_read on ts_project_types
  for select to authenticated using (ts_current_employee_id() is not null);
create policy ts_task_types_read on ts_task_types
  for select to authenticated using (ts_current_employee_id() is not null);
create policy ts_departments_read on ts_departments
  for select to authenticated using (ts_current_employee_id() is not null);

-- Weekly submissions: own rows, plus admin read-only visibility.
create policy ts_submissions_read on ts_weekly_submissions
  for select to authenticated
  using (employee_id = ts_current_employee_id() or ts_is_admin());

create policy ts_submissions_insert on ts_weekly_submissions
  for insert to authenticated
  with check (employee_id = ts_current_employee_id());

-- A submitted week is frozen. Reopening it is an admin action, not a user one.
create policy ts_submissions_update on ts_weekly_submissions
  for update to authenticated
  using (employee_id = ts_current_employee_id() and status = 'draft')
  with check (employee_id = ts_current_employee_id());

-- Entries: own rows only, and only while the week *and* the day are open.
create policy ts_entries_read on ts_entries
  for select to authenticated
  using (employee_id = ts_current_employee_id() or ts_is_admin());

create policy ts_entries_insert on ts_entries
  for insert to authenticated
  with check (
    employee_id = ts_current_employee_id()
    and status = 'draft'
    and exists (
      select 1 from ts_weekly_submissions s
      where s.id = submission_id
        and s.employee_id = ts_current_employee_id()
        and s.status = 'draft'
    )
    and not exists (
      select 1 from ts_day_locks dl
      where dl.submission_id = ts_entries.submission_id
        and dl.work_date = ts_entries.work_date
    )
  );

create policy ts_entries_update on ts_entries
  for update to authenticated
  using (
    employee_id = ts_current_employee_id()
    and status = 'draft'
    and not exists (
      select 1 from ts_day_locks dl
      where dl.submission_id = ts_entries.submission_id
        and dl.work_date = ts_entries.work_date
    )
  )
  with check (employee_id = ts_current_employee_id() and status = 'draft');

create policy ts_entries_delete on ts_entries
  for delete to authenticated
  using (
    employee_id = ts_current_employee_id()
    and status = 'draft'
    and not exists (
      select 1 from ts_day_locks dl
      where dl.submission_id = ts_entries.submission_id
        and dl.work_date = ts_entries.work_date
    )
  );

create policy ts_day_locks_read on ts_day_locks
  for select to authenticated
  using (
    exists (
      select 1 from ts_weekly_submissions s
      where s.id = submission_id
        and (s.employee_id = ts_current_employee_id() or ts_is_admin())
    )
  );

create policy ts_sheet_exports_admin_read on ts_sheet_exports
  for select to authenticated using (ts_is_admin());
