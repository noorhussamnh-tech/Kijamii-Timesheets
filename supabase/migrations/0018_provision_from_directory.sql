-- 0018: signing in is now the whole of onboarding.
--
-- The questionnaire that asked every person for their markets and their
-- department at every sign-in is gone, along with the call behind it. What it
-- collected is read from the directory instead, and the roster is filled in
-- ahead of anybody logging in at all, so the reports can name every member of
-- staff rather than only the ones who have visited.

-- ------------------------------------------------------------ provisioning

-- Writes one person's directory record onto their roster row.
--
-- The directory wins outright here, rather than only filling gaps as the title
-- sync used to. That is the whole point of the change: the fields management
-- reports on are not the employee's to set, so a value that has drifted is
-- corrected on the next sign-in rather than preserved.
--
-- Everything the directory does not speak to is left exactly as it was --
-- role, active, expected hours, and whether the person keeps a timesheet at
-- all. The CEO's exemption survives a resync because of that line.
create or replace function public.ts_apply_directory(p_email text)
returns ts_employees
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  d    ts_employee_directory;
  addr text := lower(btrim(coalesce(p_email, '')));
  m    ts_market;
  emp  ts_employees;
begin
  select * into d from ts_employee_directory where email = addr;
  if not found then
    return null;
  end if;

  m := ts_directory_market(d.entity);

  insert into ts_employees (
    full_name, email, markets, primary_market, department, title, job_function,
    timesheet_configuration, onboarded_at
  ) values (
    d.full_name,
    d.email,
    -- Every market, for everybody.
    --
    -- This field decides which clients appear in the picker, and the sheet
    -- does not answer that question: it records the entity that employs
    -- somebody, and the sheet itself shows Egypt-entity staff working KSA
    -- accounts. Narrowing the list to their entity would hide clients from the
    -- people who actually work on them, which is the error this change exists
    -- to prevent. The market stamped on each logged row still comes from the
    -- client, so the reporting stays market-accurate either way.
    case when m is null then '{}'::ts_market[] else array['EG', 'UAE', 'KSA']::ts_market[] end,
    m,
    ts_directory_department(d.business_unit, d.sub_unit),
    d."position",
    d."function",
    (case when m = 'KSA' then 'KSA' else 'EG_UAE' end)::ts_config,
    -- An entity the mapping does not recognise leaves the person un-onboarded
    -- rather than half-configured: the app then says what is missing instead
    -- of guessing a market for them.
    case when m is null then null else now() end
  )
  on conflict (email) do update set
    markets                 = excluded.markets,
    primary_market          = excluded.primary_market,
    department              = excluded.department,
    title                   = excluded.title,
    job_function            = excluded.job_function,
    timesheet_configuration = excluded.timesheet_configuration,
    onboarded_at            = coalesce(ts_employees.onboarded_at, excluded.onboarded_at),
    updated_at              = now()
  returning * into emp;

  return emp;
end;
$$;

revoke all on function public.ts_apply_directory(text) from public, anon, authenticated;

-- The signed-in person's own record, refreshed from the directory first.
--
-- Replaces the plain select the client used to make, so that "sign in and the
-- app knows who you are" is one round trip and is true on every sign-in rather
-- than only on the first one -- the auth trigger fires once, when the Google
-- account is first seen, and would never notice a later change in the sheet.
create or replace function public.ts_my_profile()
returns ts_employees
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  addr text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  emp  ts_employees;
begin
  if auth.uid() is null or addr = '' or not ts_email_domain_allowed(addr) then
    return null;
  end if;

  perform ts_apply_directory(addr);

  -- Claim the roster row for this account. Rows pre-created from the directory
  -- have no auth_user_id until their owner first signs in; a row already
  -- claimed by a different account is left alone, and this person simply does
  -- not find a record.
  update ts_employees
     set auth_user_id = auth.uid(), updated_at = now()
   where email = addr and auth_user_id is null;

  select * into emp from ts_employees where auth_user_id = auth.uid();
  if not found then
    return null;
  end if;
  return emp;
end;
$$;

grant execute on function public.ts_my_profile() to authenticated;

-- A new Google account still gets a roster row on sight, so that the very
-- first request already has one to find. Everything about who they are comes
-- from the directory; only the display name comes from Google, because the
-- sheet holds legal names and people are known by neither more nor less than
-- what their account says.
create or replace function public.ts_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  addr     text := lower(coalesce(new.email, ''));
  verified boolean := coalesce((new.raw_user_meta_data ->> 'email_verified')::boolean, false);
  display  text := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''),
                            nullif(new.raw_user_meta_data ->> 'name', ''));
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

  perform ts_apply_directory(addr);

  insert into ts_employees (auth_user_id, full_name, email, role)
  values (new.id, coalesce(display, split_part(addr, '@', 1)), addr,
          (case when is_seed_admin then 'admin' else 'employee' end)::ts_role)
  on conflict (email) do update
    set auth_user_id = coalesce(ts_employees.auth_user_id, excluded.auth_user_id),
        full_name    = coalesce(display, ts_employees.full_name, excluded.full_name),
        role         = case when is_seed_admin then 'admin'::ts_role else ts_employees.role end,
        updated_at   = now();

  return new;
end;
$$;

-- ------------------------------------------------------------------ resync

-- Re-reads the whole directory onto the roster.
--
-- New accounts pick their details up on sign-in without anybody pressing
-- anything, so this is for the case where the sheet changed under people who
-- are already here -- a promotion, a move between teams, a new hire who should
-- appear in the reports before their first login.
--
-- It never deactivates. Somebody on the roster but missing from the sheet is
-- reported and left alone: the sheet may simply be behind, and quietly
-- switching off a real person's timesheet is not a mistake worth risking.
create or replace function public.ts_sync_directory()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  d          record;
  created    integer := 0;
  applied    integer := 0;
  unmapped   integer;
  off_sheet  integer;
begin
  if not ts_is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  for d in select email from ts_employee_directory loop
    if not exists (select 1 from ts_employees e where e.email = d.email) then
      created := created + 1;
    end if;
    perform ts_apply_directory(d.email);
    applied := applied + 1;
  end loop;

  -- Both counts skip anybody exempt from keeping a timesheet. Somebody who is
  -- deliberately not on the sheet's terms -- the CEO -- is not an outstanding
  -- problem, and reporting them as one every single run teaches an admin to
  -- ignore the number that is meant to catch the real cases.
  select count(*) into unmapped
    from ts_employees e
   where e.active and e.logs_timesheet and e.onboarded_at is null;

  select count(*) into off_sheet
    from ts_employees e
   where e.active and e.logs_timesheet
     and not exists (select 1 from ts_employee_directory d2 where d2.email = e.email);

  insert into ts_audit_log (actor_email, action, record_type, record_id, details)
  values ((select email from ts_employees where auth_user_id = auth.uid()),
          'directory.synced', 'directory', 'all',
          jsonb_build_object('applied', applied, 'created', created));

  return jsonb_build_object(
    'directory_rows', (select count(*) from ts_employee_directory),
    'applied', applied,
    'created', created,
    'unmapped', unmapped,
    'not_in_directory', off_sheet);
end;
$$;

grant execute on function public.ts_sync_directory() to authenticated;

-- The questionnaire is gone, and so is the call behind it.
drop function if exists public.ts_complete_onboarding(ts_market[], ts_market, text, numeric);
drop function if exists public.ts_sync_titles_from_directory();

-- ----------------------------------------------------------------- backfill

-- Everybody in the sheet gets a roster row now, not only the people who have
-- signed in. The reports are meant to name every member of staff, including
-- the ones who logged nothing -- which they cannot do while the roster is a
-- list of whoever happened to log in.
do $$
declare
  d record;
begin
  for d in select email from ts_employee_directory loop
    perform ts_apply_directory(d.email);
  end loop;
end;
$$;
