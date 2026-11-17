-- 0068: the OPS list can be loaded from the admin page instead of by hand.
--
-- Sync Directory never read the employee list. It read ts_employee_directory
-- and pushed it onto the roster -- useful, but it only ever redistributed what
-- was already there. Nothing except a migration written by a person could put
-- anything *into* the directory, which is why Bassma Elkaramany signed in on
-- 2 November and could not log a single hour until 17 November: she was in the
-- sheet the whole time and in the database not at all, and no button anybody
-- could press would have changed that.
--
-- The obvious fix is not available. The repo already records the attempt --
-- ExportToSheets says Kijamii's Workspace policy blocks sharing a spreadsheet
-- with an external service account -- so the database cannot go and read the
-- sheet itself, and no amount of code here changes that.
--
-- What it can do is accept the list. This takes the rows an admin supplies
-- from the sheet, checks them properly, and applies them the way 0053 and 0061
-- did, so the step that used to need me writing SQL is a file and a button.
--
-- It refuses the whole import rather than applying part of one. Every defect
-- this session turned up came from the sheet drifting a row at a time --
-- 101% dedication, two people sharing one address, a team name in the name
-- column -- and half-importing a list like that is how a directory ends up
-- wrong in a way nobody can see. The caller can ask for a dry run, which
-- reports exactly the same findings and changes nothing, so the refusal
-- arrives before anybody commits to it rather than after.
--
-- Nobody is deleted. A person the sheet stops naming keeps their record and is
-- reported as absent, because a name missing from a spreadsheet is not a
-- resignation -- the rule 0053 set, kept here.

create or replace function public.ts_import_directory(
  p_people     jsonb,
  p_dedication jsonb default '[]'::jsonb,
  p_apply      boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  problems jsonb := '[]'::jsonb;
  summary  jsonb;
  n_added  integer := 0;
  n_changed integer := 0;
  n_same   integer := 0;
  n_absent integer := 0;
  n_teams  integer := 0;
begin
  if not ts_is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_people is null or jsonb_typeof(p_people) <> 'array' then
    raise exception 'people must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_people) = 0 then
    raise exception 'the list is empty' using errcode = '22023';
  end if;

  create temp table imp_people (
    email text, full_name text, business_unit text, sub_unit text,
    "function" text, manager text, entity text
  ) on commit drop;

  create temp table imp_ded (email text, team text, pct numeric) on commit drop;

  insert into imp_people
  select lower(btrim(r->>'email')), btrim(r->>'full_name'),
         nullif(btrim(coalesce(r->>'business_unit','')), ''),
         nullif(btrim(coalesce(r->>'sub_unit','')), ''),
         nullif(btrim(coalesce(r->>'function','')), ''),
         nullif(btrim(coalesce(r->>'manager','')), ''),
         nullif(btrim(coalesce(r->>'entity','')), '')
    from jsonb_array_elements(p_people) r;

  insert into imp_ded
  select lower(btrim(r->>'email')), btrim(r->>'team'), (r->>'pct')::numeric
    from jsonb_array_elements(coalesce(p_dedication, '[]'::jsonb)) r
   where coalesce(btrim(r->>'team'), '') <> '';

  -- ------------------------------------------------------------- the checks

  -- An address that is not an address, or a person with no name, is not
  -- something to guess at.
  select problems || coalesce(jsonb_agg(jsonb_build_object(
           'kind', 'bad_row', 'email', coalesce(email,'(blank)'),
           'detail', 'needs both an email and a name')), '[]'::jsonb)
    into problems
    from imp_people
   where coalesce(email,'') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      or coalesce(full_name,'') = '';

  -- Two people behind one address. This is the Mariam Taher case: the
  -- directory is keyed on email, so one of them simply would not exist, and
  -- the import must not be the thing that decides which.
  select problems || coalesce(jsonb_agg(jsonb_build_object(
           'kind', 'shared_email', 'email', email,
           'detail', 'used by more than one name: ' || names)), '[]'::jsonb)
    into problems
    from (select email, string_agg(distinct full_name, ' | ' order by full_name) as names
            from imp_people where full_name <> '' group by email
          having count(distinct full_name) > 1) q;

  -- Nobody is more than one person.
  select problems || coalesce(jsonb_agg(jsonb_build_object(
           'kind', 'over_dedicated', 'email', email,
           'detail', 'dedication totals ' || total || '%')), '[]'::jsonb)
    into problems
    from (select email, sum(pct) as total from imp_ded group by email
          having sum(pct) > 100.009) q;

  -- Staffing for somebody the list does not describe.
  select problems || coalesce(jsonb_agg(jsonb_build_object(
           'kind', 'orphan_dedication', 'email', d.email,
           'detail', 'staffed onto ' || d.team || ' but not in the list')), '[]'::jsonb)
    into problems
    from (select distinct email, team from imp_ded d
           where not exists (select 1 from imp_people p where p.email = d.email)) d;

  -- ------------------------------------------------------------- the diff

  select count(*) into n_added
    from imp_people i
   where not exists (select 1 from ts_employee_directory d where d.email = i.email);

  select count(*) into n_changed
    from imp_people i
    join ts_employee_directory d on d.email = i.email
   where d.full_name     is distinct from i.full_name
      or d.business_unit is distinct from i.business_unit
      or d.sub_unit      is distinct from i.sub_unit
      or d."function"    is distinct from i."function"
      or d.manager       is distinct from i.manager
      or d.entity        is distinct from i.entity;

  select count(*) into n_same
    from imp_people i join ts_employee_directory d on d.email = i.email
   where d.full_name     is not distinct from i.full_name
     and d.business_unit is not distinct from i.business_unit
     and d.sub_unit      is not distinct from i.sub_unit
     and d."function"    is not distinct from i."function"
     and d.manager       is not distinct from i.manager
     and d.entity        is not distinct from i.entity;

  -- Reported, never removed: a name missing from a spreadsheet is not a
  -- resignation.
  select count(*) into n_absent
    from ts_employee_directory d
   where not exists (select 1 from imp_people i where i.email = d.email);

  select count(distinct d.team) into n_teams
    from imp_ded d
   where not exists (select 1 from ts_teams t where lower(t.name) = lower(d.team));

  summary := jsonb_build_object(
    'rows_in',   jsonb_array_length(p_people),
    'people',    (select count(*) from imp_people),
    'added',     n_added,
    'changed',   n_changed,
    'unchanged', n_same,
    'absent_from_list', n_absent,
    'new_teams', n_teams,
    'problems',  problems,
    'applied',   false);

  if jsonb_array_length(problems) > 0 then
    return summary || jsonb_build_object('ok', false);
  end if;
  if not p_apply then
    return summary || jsonb_build_object('ok', true);
  end if;

  -- ------------------------------------------------------------ the writing

  insert into ts_teams (name)
  select distinct d.team from imp_ded d
   where not exists (select 1 from ts_teams t where lower(t.name) = lower(d.team));

  insert into ts_employee_directory
         (email, full_name, business_unit, sub_unit, "function", manager, entity)
  select i.email, i.full_name, i.business_unit, i.sub_unit, i."function", i.manager, i.entity
    from imp_people i
  on conflict (email) do update
     set full_name     = excluded.full_name,
         business_unit = excluded.business_unit,
         sub_unit      = excluded.sub_unit,
         "function"    = excluded."function",
         manager       = excluded.manager,
         entity        = excluded.entity,
         synced_at     = now();

  -- Staffing is replaced for the people named, never merged: somebody taken
  -- off a team has a row that should disappear. People the list does not name
  -- are left exactly as they are.
  delete from ts_employee_teams d
   where exists (select 1 from imp_people i where i.email = d.email)
     and not exists (
       select 1 from imp_ded v join ts_teams t on lower(t.name) = lower(v.team)
        where v.email = d.email and t.id = d.team_id);

  insert into ts_employee_teams (email, team_id, dedication_pct)
  select v.email, t.id, sum(v.pct)
    from imp_ded v join ts_teams t on lower(t.name) = lower(v.team)
   group by v.email, t.id
  on conflict (email, team_id) do update
     set dedication_pct = excluded.dedication_pct, synced_at = now();

  -- Give everybody named a usable roster row, which is what Sync Directory
  -- would do afterwards anyway. Doing it here means a new joiner can log the
  -- moment the list reaches the database rather than waiting for a second
  -- button to be pressed by somebody who knows it exists.
  perform ts_apply_directory(i.email) from imp_people i;

  insert into ts_audit_log (actor_email, action, record_type, record_id, details)
  values ((select email from ts_employees where auth_user_id = auth.uid()),
          'directory.imported', 'directory', 'all',
          summary || jsonb_build_object('applied', true));

  return summary || jsonb_build_object('ok', true, 'applied', true);
end;
$fn$;

comment on function public.ts_import_directory(jsonb, jsonb, boolean) is
  'Loads the OPS employee list into the directory. Admin only. Refuses the '
  'whole import if the list contradicts itself; p_apply false reports the same '
  'findings and changes nothing. Never deletes a person.';

revoke all on function public.ts_import_directory(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.ts_import_directory(jsonb, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------- the checks
do $$
declare r jsonb;
begin
  -- A dry run must change nothing, so it is safe to prove it with real shapes.
  -- ts_is_admin() is false for this migration's role, so each call must refuse
  -- rather than quietly report success on an empty set.
  begin
    r := ts_import_directory('[{"email":"x@kijamii.com","full_name":"X Y"}]'::jsonb, '[]'::jsonb, false);
    raise exception 'a non-admin was allowed to import';
  exception
    when insufficient_privilege then null;
  end;

  if ts_no_anon_functions() <> 0 then
    raise exception 'the import reopened anon access';
  end if;
end $$;
