-- 0028: an hour can say which team it was for, and the export that compares
-- what we assumed against what happened.
--
-- The two writers are rewritten from the catalogue rather than restated, so
-- this migration cannot silently drop a clause somebody added since. Each
-- replacement asserts it hit exactly what it expected to.

-- ------------------------------------------------ the draft carries a team

do $$
declare src text; out text; hits int;
begin
  src := pg_get_functiondef('public.ts_save_draft(date, jsonb, bigint)'::regprocedure);

  out := replace(src,
    'hours, billable, work_type, market, department, status',
    'hours, billable, work_type, team_id, market, department, status');
  if out = src then raise exception 'ts_save_draft: column list not found'; end if;
  src := out;

  out := replace(src,
    E'      nullif(item ->> \'work_type\', \'\')::ts_work_type,\n',
    E'      nullif(item ->> \'work_type\', \'\')::ts_work_type,\n      nullif(item ->> \'team_id\', \'\')::uuid,\n');
  if out = src then raise exception 'ts_save_draft: work_type value not found'; end if;
  src := out;

  out := replace(src,
    E'      work_type    = excluded.work_type,\n',
    E'      work_type    = excluded.work_type,\n      team_id      = excluded.team_id,\n');
  if out = src then raise exception 'ts_save_draft: work_type conflict clause not found'; end if;

  execute out;
end $$;

-- -------------------------------------------------- the reader returns it

do $$
declare src text; out text;
begin
  src := pg_get_functiondef('public.ts_get_week(date)'::regprocedure);
  out := replace(src,
    E'\'status\', e.status, \'market\', e.market)',
    E'\'status\', e.status, \'market\', e.market, \'teamId\', e.team_id)');
  if out = src then raise exception 'ts_get_week: entry object not found'; end if;
  execute out;
end $$;

-- ------------------------------------------- the teams a person may pick

-- Only the teams the OPS list staffs this person onto. Somebody it staffs
-- onto nothing gets an empty list and no Team column to fill, which is the
-- honest answer rather than the whole company in a dropdown.
create or replace function public.ts_my_teams()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'name', t.name, 'dedicationPct', d.dedication_pct)
           order by d.dedication_pct desc, t.name), '[]'::jsonb)
    from ts_employee_teams d
    join ts_teams t on t.id = d.team_id
   where d.email = (select lower(e.email) from ts_employees e
                     where e.auth_user_id = auth.uid() and e.active)
     and t.active;
$$;

-- --------------------------------------- assumed against actual, per team

-- One row per person per team, in the OPS list's own column order, so the
-- result can be pasted beside the sheet month after month.
--
-- A full join, not a left join: a team somebody logged hours against but is
-- not staffed on is exactly the finding this export exists to surface, and it
-- arrives with a blank assumed percentage rather than being dropped.
--
-- The actual percentage is that team's share of what the person logged in the
-- period -- not of their contracted hours -- so it is comparable with an
-- assumed split that also totals 100%. Somebody who logged nothing has no
-- denominator and gets null rather than a zero that reads like idleness.
create or replace function public.ts_export_team_dedication(p_from date, p_to date)
returns table (
  full_name      text,
  email          text,
  business_unit  text,
  sub_unit       text,
  job_function   text,
  manager        text,
  team           text,
  assumed_pct    numeric,
  actual_hours   numeric,
  actual_pct     numeric
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with actual as (
    select lower(emp.email) as email, e.team_id, sum(e.hours) as hours
      from ts_entries e
      join ts_employees emp on emp.id = e.employee_id
     where e.work_date between p_from and p_to
       and e.status = 'submitted'
       and e.team_id is not null
     group by 1, 2
  ),
  logged_total as (
    select lower(emp.email) as email, sum(e.hours) as hours
      from ts_entries e
      join ts_employees emp on emp.id = e.employee_id
     where e.work_date between p_from and p_to
       and e.status = 'submitted'
     group by 1
  ),
  pair as (
    select coalesce(d.email, a.email) as email,
           coalesce(d.team_id, a.team_id) as team_id,
           d.dedication_pct,
           a.hours
      from ts_employee_teams d
      full join actual a on a.email = d.email and a.team_id = d.team_id
  )
  select dir.full_name,
         p.email,
         dir.business_unit,
         dir.sub_unit,
         dir."function",
         dir.manager,
         t.name,
         p.dedication_pct,
         round(coalesce(p.hours, 0), 2),
         case when lt.hours is null or lt.hours = 0 then null
              else round(coalesce(p.hours, 0) * 100.0 / lt.hours, 1) end
    from pair p
    join ts_teams t on t.id = p.team_id
    left join ts_employee_directory dir on dir.email = p.email
    left join logged_total lt on lt.email = p.email
   where ts_is_admin()
   order by dir.full_name nulls last, t.name;
$$;

revoke all on function public.ts_export_team_dedication(date, date) from public;
grant execute on function public.ts_export_team_dedication(date, date) to authenticated;
grant execute on function public.ts_my_teams() to authenticated;
