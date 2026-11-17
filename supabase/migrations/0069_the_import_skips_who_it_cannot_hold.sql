-- 0069: the import skips the people it cannot hold, instead of refusing.
--
-- 0068 treated every finding as fatal. Run against the actual OPS list that is
-- a rule which can never pass: the sheet permanently carries people with no
-- company address -- a security guard, two runners, an office boy, five rows
-- in all -- who cannot hold a timesheet and never will. Under 0068 the import
-- would have refused every time it was pressed, for a reason nobody could fix,
-- which is a worse failure than the gap it was written to close.
--
-- Caught by running the parser over the real file before wiring any of it to a
-- button, which is the only reason it is being fixed here rather than reported
-- next week.
--
-- The two kinds of finding are now kept apart, because they are not alike:
--
--   skipped   -- the row cannot be imported and nothing else is affected: no
--                address, no name, an address that is not one. Counted,
--                named, and left out. The list still loads.
--   blocking  -- the list contradicts itself, so importing any of it would
--                leave the directory wrong in a way nobody can see: one
--                address given two names, somebody staffed past 100%,
--                staffing for a person the list does not describe. Nothing is
--                written at all.
--
-- Dedication rows belonging to a skipped person are dropped with them, or they
-- would read as staffing for somebody who is not there and block the import on
-- the strength of a row that was already excluded.

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
  skipped  jsonb := '[]'::jsonb;
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

  -- ------------------------------------------------------------ the skipped

  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', 'no_account', 'email', coalesce(nullif(email,''),'(blank)'),
           'name', coalesce(nullif(full_name,''),'(no name)'),
           'detail', 'no usable email address, so no timesheet')), '[]'::jsonb)
    into skipped
    from imp_people
   where coalesce(email,'') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      or coalesce(full_name,'') = '';

  delete from imp_ded
   where email not in (
     select email from imp_people
      where coalesce(email,'') ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        and coalesce(full_name,'') <> '');

  delete from imp_people
   where coalesce(email,'') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      or coalesce(full_name,'') = '';

  if (select count(*) from imp_people) = 0 then
    raise exception 'every row was skipped: no usable rows in the list'
      using errcode = '22023';
  end if;

  -- ----------------------------------------------------------- the blocking

  select problems || coalesce(jsonb_agg(jsonb_build_object(
           'kind', 'shared_email', 'email', email,
           'detail', 'used by more than one name: ' || names)), '[]'::jsonb)
    into problems
    from (select email, string_agg(distinct full_name, ' | ' order by full_name) as names
            from imp_people group by email
          having count(distinct full_name) > 1) q;

  select problems || coalesce(jsonb_agg(jsonb_build_object(
           'kind', 'over_dedicated', 'email', email,
           'detail', 'dedication totals ' || total || '%')), '[]'::jsonb)
    into problems
    from (select email, sum(pct) as total from imp_ded group by email
          having sum(pct) > 100.009) q;

  select problems || coalesce(jsonb_agg(jsonb_build_object(
           'kind', 'orphan_dedication', 'email', d.email,
           'detail', 'staffed onto ' || d.team || ' but not in the list')), '[]'::jsonb)
    into problems
    from (select distinct email, team from imp_ded d
           where not exists (select 1 from imp_people p where p.email = d.email)) d;

  -- --------------------------------------------------------------- the diff

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
    'skipped',   skipped,
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

  perform ts_apply_directory(i.email) from imp_people i;

  insert into ts_audit_log (actor_email, action, record_type, record_id, details)
  values ((select email from ts_employees where auth_user_id = auth.uid()),
          'directory.imported', 'directory', 'all',
          summary || jsonb_build_object('applied', true));

  return summary || jsonb_build_object('ok', true, 'applied', true);
end;
$fn$;

comment on function public.ts_import_directory(jsonb, jsonb, boolean) is
  'Loads the OPS employee list into the directory. Admin only. Rows with no '
  'usable address are skipped and named; a list that contradicts itself is '
  'refused whole. p_apply false reports the same findings and writes nothing. '
  'Never deletes a person.';

revoke all on function public.ts_import_directory(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.ts_import_directory(jsonb, jsonb, boolean) to authenticated;

do $$
begin
  begin
    perform ts_import_directory('[{"email":"x@kijamii.com","full_name":"X Y"}]'::jsonb, '[]'::jsonb, false);
    raise exception 'a non-admin was allowed to import';
  exception
    when insufficient_privilege then null;
  end;

  if ts_no_anon_functions() <> 0 then
    raise exception 'the import reopened anon access';
  end if;
end $$;
