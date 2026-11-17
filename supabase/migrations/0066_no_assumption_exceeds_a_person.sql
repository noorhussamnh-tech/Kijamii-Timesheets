-- 0066: nothing this tool assumes about a person exceeds one person.
--
-- Two ceilings, set as a rule rather than discovered one report at a time:
-- assumed dedication never exceeds 100%, and assumed hours never exceed 160 in
-- a calendar month. What somebody actually submits is accepted as it stands,
-- above or below. The rule governs what the tool presumes, never what a person
-- reports.
--
-- ------------------------------------------------------- 176 hours a month
--
-- Both range overviews computed expected hours as
--
--     expected_weekly_hours / 5 * working_days_in_range
--
-- which is 8 hours times every Sunday-to-Thursday in the period. Over a full
-- month that is 22 working days and 176 hours -- sixteen over the ceiling, and
-- enough to make somebody filing a complete month read as 91% of their
-- capacity. The denominator was inventing overtime and then marking people
-- down against it.
--
-- ts_assumed_hours caps per calendar month rather than across the whole range,
-- because the ceiling is monthly: a quarter is three months of 160, not one.
-- A part-week or part-month never reaches the cap and is unaffected, so the
-- month-to-date figures that the daily report leans on do not move at all.
--
-- --------------------------------------------------------------- over 100%
--
-- ts_export_team_dedication multiplies each person's dedication by a monthly
-- capacity, so a sheet row saying 101% assumes 101% of a person exists. Seven
-- people were over on the OPS list this morning and five have been corrected,
-- which is exactly the point: the sheet is edited by people and will drift
-- again. The export now scales a person's rows down proportionally when they
-- total more than 100, so the figure is right here whatever the sheet says
-- this week. Under 100 is left alone -- somebody deliberately at 99% is not an
-- error to paper over, and inflating them would invent capacity.
--
-- The 140-hour constant that function uses as monthly capacity is left as it
-- is. It sits under the 160 ceiling, so it does not break the rule, but it
-- does disagree with the 160 the overviews now use. Picking one is a business
-- decision about what a month of capacity means, not a defect to fix quietly
-- inside a migration, so it is flagged rather than changed.

create or replace function public.ts_assumed_hours(
  p_from   date,
  p_to     date,
  p_weekly numeric default 40)
returns numeric
language sql
stable
set search_path to 'public', 'pg_temp'
as $fn$
  -- Capped per calendar month, because the ceiling is monthly. Working days
  -- are Sunday to Thursday, the week in both Egypt and Saudi Arabia.
  select coalesce(round(sum(least(mo.working_days * (coalesce(p_weekly, 40) / 5.0), 160)), 2), 0)
    from (
      select date_trunc('month', d)::date as month_start,
             count(*)                     as working_days
        from generate_series(p_from, p_to, interval '1 day') d
       where extract(dow from d) between 0 and 4
       group by 1
    ) mo;
$fn$;

comment on function public.ts_assumed_hours(date, date, numeric) is
  'Hours the tool may assume of one person over a period: 8 per working day, '
  'never more than 160 in a calendar month. The ceiling is a rule, not a '
  'measurement -- what somebody submits is taken as it stands.';

grant execute on function public.ts_assumed_hours(date, date, numeric) to authenticated;

create or replace function public.ts_admin_range_overview(p_from date, p_to date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not (ts_is_admin() or ts_i_manage_anyone()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 800 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'employees', coalesce((
      select jsonb_agg(jsonb_build_object(
               'employeeId', emp.id, 'name', emp.full_name, 'email', emp.email,
               'markets', emp.markets, 'primaryMarket', emp.primary_market,
               'department', emp.department,
               'manager', dir.manager,
               'teams', coalesce(tm.names, array[]::text[]),
               'expectedHours', ts_assumed_hours(p_from, p_to, emp.expected_weekly_hours),
               'status', ts_period_status(live.answered, live.drafts),
               'totalHours', coalesce(live.filed, 0),
               'draftHours', coalesce(live.unfiled, 0),
               'submittedAt', live.last_submitted)
               order by emp.full_name)
        from ts_employees emp
        left join ts_employee_directory dir on dir.email = emp.email
        left join lateral (
               select array_agg(t.name order by t.name) as names
                 from ts_employee_teams d
                 join ts_teams t on t.id = d.team_id
                where d.email = lower(emp.email)
             ) tm on true
        left join lateral (
               select count(*) filter (where e.status <> 'draft')                 as answered,
                      count(*) filter (where e.status = 'draft'
                                         and e.hours is not null)                 as drafts,
                      coalesce(sum(e.hours) filter (where e.status <> 'draft'), 0) as filed,
                      coalesce(sum(e.hours) filter (where e.status = 'draft'), 0)  as unfiled,
                      max(e.submitted_at)                                         as last_submitted
                 from ts_entries e
                where e.employee_id = emp.id
                  and e.work_date between p_from and p_to
             ) live on true
       where emp.active and emp.onboarded_at is not null
         and emp.logs_timesheet
         and (ts_is_admin() or lower(emp.email) in (select email from ts_my_report_emails()))), '[]'::jsonb));
end;
$function$;

create or replace function public.ts_team_range_overview(p_from date, p_to date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- No admin escape: this one is the reporting line or nothing.
  if not ts_i_manage_anyone() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 800 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'employees', coalesce((
      select jsonb_agg(jsonb_build_object(
               'employeeId', emp.id, 'name', emp.full_name, 'email', emp.email,
               'markets', emp.markets, 'primaryMarket', emp.primary_market,
               'department', emp.department,
               'manager', dir.manager,
               'teams', coalesce(tm.names, array[]::text[]),
               'expectedHours', ts_assumed_hours(p_from, p_to, emp.expected_weekly_hours),
               'status', ts_period_status(live.answered, live.drafts),
               'totalHours', coalesce(live.filed, 0),
               'draftHours', coalesce(live.unfiled, 0),
               'submittedAt', live.last_submitted)
               order by emp.full_name)
        from ts_employees emp
        left join ts_employee_directory dir on dir.email = emp.email
        left join lateral (
               select array_agg(t.name order by t.name) as names
                 from ts_employee_teams d
                 join ts_teams t on t.id = d.team_id
                where d.email = lower(emp.email)
             ) tm on true
        left join lateral (
               select count(*) filter (where e.status <> 'draft')                 as answered,
                      count(*) filter (where e.status = 'draft'
                                         and e.hours is not null)                 as drafts,
                      coalesce(sum(e.hours) filter (where e.status <> 'draft'), 0) as filed,
                      coalesce(sum(e.hours) filter (where e.status = 'draft'), 0)  as unfiled,
                      max(e.submitted_at)                                         as last_submitted
                 from ts_entries e
                where e.employee_id = emp.id
                  and e.work_date between p_from and p_to
             ) live on true
       where emp.active and emp.onboarded_at is not null
         and emp.logs_timesheet
         and lower(emp.email) in (select email from ts_my_team_emails())), '[]'::jsonb));
end;
$function$;

create or replace function public.ts_export_team_dedication(p_from date, p_to date)
returns table(full_name text, email text, entity text, business_unit text,
              sub_unit text, job_function text, manager text, team text,
              assumed_pct numeric, assumed_hours numeric,
              actual_hours numeric, actual_pct numeric)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
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
  ),
  -- Nobody is assumed to be more than one person. A sheet that totals 101%
  -- scales back to 100 across their rows; under 100 is left alone, because a
  -- deliberate 99% is not an error and inflating it would invent capacity.
  capped as (
    select p.*,
           sum(coalesce(p.dedication_pct, 0)) over (partition by p.email) as person_total
      from pair p
  )
  select dir.full_name,
         p.email,
         dir.entity,
         dir.business_unit,
         dir.sub_unit,
         dir."function",
         dir.manager,
         t.name,
         round(p.scaled_pct, 2),
         round(p.scaled_pct / 100.0 * c.h, 2),
         round(coalesce(p.hours, 0), 2),
         round(coalesce(p.hours, 0) * 100.0 / c.h, 1)
    from (select capped.*,
                 case when capped.person_total > 100
                      then coalesce(capped.dedication_pct, 0) * 100.0 / capped.person_total
                      else coalesce(capped.dedication_pct, 0) end as scaled_pct
            from capped) p
    cross join capacity c
    join ts_teams t on t.id = p.team_id
    left join ts_employee_directory dir on dir.email = p.email
   where ts_is_admin()
   order by dir.full_name nulls last, t.name;
$function$;

revoke all on function public.ts_export_team_dedication(date, date) from public, anon;
grant execute on function public.ts_export_team_dedication(date, date) to authenticated;

-- ---------------------------------------------------------------- the checks
do $$
declare v numeric; bad integer;
begin
  -- A full month of 22 working days is 176 before the rule and 160 after it.
  v := ts_assumed_hours(date '2026-10-01', date '2026-10-31', 40);
  if v <> 160 then raise exception 'a full October assumes % hours, not 160', v; end if;

  -- A part month is untouched: 1-16 Nov is 12 working days, 96 hours.
  v := ts_assumed_hours(date '2026-11-01', date '2026-11-16', 40);
  if v <> 96 then raise exception 'half of November assumes % hours, not 96', v; end if;

  -- The ceiling is monthly, so a quarter is three of them.
  v := ts_assumed_hours(date '2026-10-01', date '2026-12-31', 40);
  if v <> 160 + 160 + ts_assumed_hours(date '2026-12-01', date '2026-12-31', 40) then
    raise exception 'a quarter does not add up to its months';
  end if;

  -- A part-timer never reaches a ceiling meant for a full one. October 2026
  -- holds 21 working days, so a 20-hour week assumes 84 and the cap on a
  -- 40-hour week bites at 160 rather than 168.
  v := ts_assumed_hours(date '2026-10-01', date '2026-10-31', 20);
  if v <> 84 then raise exception 'a 20-hour week assumes % in October, not 84', v; end if;

  -- And no overview may now assume more than 160 of anybody in a month.
  select count(*) into bad
    from ts_employees e
   where e.active and e.logs_timesheet
     and ts_assumed_hours(date '2026-10-01', date '2026-10-31', e.expected_weekly_hours) > 160;
  if bad <> 0 then raise exception '% people are still assumed over 160 hours', bad; end if;

  -- Nobody is assumed to be more than one person, whatever the sheet says.
  -- Checked against the staffing table rather than by calling the export,
  -- because that function is admin-gated and would hand this migration an
  -- empty set -- a check that passes because it saw nothing is not a check.
  select count(*) into bad
    from (
      select d.email,
             sum(case when tot.person_total > 100
                      then d.dedication_pct * 100.0 / tot.person_total
                      else d.dedication_pct end) as pct
        from ts_employee_teams d
        join (select email, sum(dedication_pct) as person_total
                from ts_employee_teams group by email) tot on tot.email = d.email
       group by d.email
    ) q
   where pct > 100.009;
  if bad <> 0 then raise exception '% people are still assumed over 100%%', bad; end if;

  -- The scaling must actually bite on the people who are over today.
  select count(*) into bad
    from (select email, sum(dedication_pct) as pct from ts_employee_teams group by email) q
   where pct > 100.009;
  raise notice '% people are over 100%% in the staffing table and are scaled back on read', bad;
end $$;
