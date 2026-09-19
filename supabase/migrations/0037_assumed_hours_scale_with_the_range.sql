-- 0037: 140 hours is a month, so the range decides how many of them there are.
--
-- Assumed Hours was 140 flat however long the period. Safe while the export
-- was run a month at a time; wrong the moment somebody picks a quarter, where
-- it reported a third of the truth and Actual % reported three times it.
--
-- Counted as the fraction of each calendar month the range covers, summed.
-- That is exact for the case this is built for -- a whole month is 1.0, a
-- quarter is 3.0 -- and proportional for anything else, rather than a
-- days-over-30.44 approximation that would make September come out at 138
-- hours and invite somebody to wonder why.
--
-- Not counted in working days: 140 is a figure the company states per month,
-- not one derived from a working week, and the working week is not the same
-- in Egypt as it is in the UAE.

create or replace function public.ts_months_in_range(p_from date, p_to date)
returns numeric
language sql
immutable
as $$
  select coalesce(sum(
           (least(p_to, (m + interval '1 month - 1 day')::date)
            - greatest(p_from, m::date) + 1)::numeric
           / extract(day from (m + interval '1 month - 1 day'))::numeric
         ), 0)
    from generate_series(date_trunc('month', p_from::timestamp),
                         date_trunc('month', p_to::timestamp),
                         interval '1 month') m;
$$;

comment on function public.ts_months_in_range(date, date) is
  'How many months a range covers, to one decimal or better. A whole calendar '
  'month is exactly 1.0 and a quarter exactly 3.0; a part month is its share.';

create or replace function public.ts_export_team_dedication(p_from date, p_to date)
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
  -- Both sides over the same denominator, so they stay subtractable however
  -- long the range is. nullif keeps a zero-length range from dividing by nought.
  with capacity as (select nullif(140::numeric * ts_months_in_range(p_from, p_to), 0) as h),
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
         round(p.dedication_pct / 100.0 * c.h, 2),
         round(coalesce(p.hours, 0), 2),
         round(coalesce(p.hours, 0) * 100.0 / c.h, 1)
    from pair p
    cross join capacity c
    join ts_teams t on t.id = p.team_id
    left join ts_employee_directory dir on dir.email = p.email
   where ts_is_admin()
   order by dir.full_name nulls last, t.name;
$$;

revoke all on function public.ts_export_team_dedication(date, date) from public;
grant execute on function public.ts_export_team_dedication(date, date) to authenticated;
