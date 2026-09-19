-- 0035: the dedication export carries Entity.
--
-- From ts_employee_directory, which has one for all 134 people, rather than
-- from the OPS sheet's new column -- that one is still being filled in and
-- contradicts itself for half the people who have it.
--
-- Dropped rather than replaced because the row type gains a column.

drop function if exists public.ts_export_team_dedication(date, date);

create function public.ts_export_team_dedication(p_from date, p_to date)
returns table (
  full_name      text,
  email          text,
  entity         text,
  business_unit  text,
  sub_unit       text,
  job_function   text,
  manager        text,
  team           text,
  assumed_pct    numeric,
  assumed_hours  numeric,
  actual_hours   numeric,
  actual_pct     numeric
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with month_hours as (select 140::numeric as h),
  actual as (
    select lower(emp.email) as email, e.team_id, sum(e.hours) as hours
      from ts_entries e
      join ts_employees emp on emp.id = e.employee_id
     where e.work_date between p_from and p_to
       and e.status = 'submitted'
       and e.team_id is not null
     group by 1, 2
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
         dir.entity,
         dir.business_unit,
         dir.sub_unit,
         dir."function",
         dir.manager,
         t.name,
         p.dedication_pct,
         round(p.dedication_pct / 100.0 * m.h, 2),
         round(coalesce(p.hours, 0), 2),
         round(coalesce(p.hours, 0) * 100.0 / m.h, 1)
    from pair p
    cross join month_hours m
    join ts_teams t on t.id = p.team_id
    left join ts_employee_directory dir on dir.email = p.email
   where ts_is_admin()
   order by dir.full_name nulls last, t.name;
$$;

revoke all on function public.ts_export_team_dedication(date, date) from public;
grant execute on function public.ts_export_team_dedication(date, date) to authenticated;
