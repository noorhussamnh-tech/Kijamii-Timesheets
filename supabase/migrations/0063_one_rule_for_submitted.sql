-- 0063: one definition of "submitted", and nothing callable without signing in.
--
-- Written after going looking rather than waiting for the next report. Two
-- findings, both of the same family as the Calendar Year View defect: a rule
-- written down more than once, drifting apart in the copies.
--
-- ------------------------------------------- three answers to one question
--
-- "Has this person submitted?" was computed three different ways:
--
--   ts_admin_week_overview  read ts_weekly_submissions.status -- the week-level
--                           flag, set when the week was filed and never
--                           revisited when its rows changed afterwards.
--   ts_*_range_overview     derived it from the entries, counting any draft row.
--   ts_list_my_days         derived it per day, counting any draft row.
--
-- They disagree on live data. Twelve person-weeks are flagged submitted by the
-- week-level flag while still holding real draft hours -- a week a manager
-- would sign off with unfiled time inside it. That direction is the dangerous
-- one, and submission.status is the odd one out: it records that somebody
-- pressed submit once, not whether the week is now complete. Nothing in the
-- app calls that function today, so this is a trap rather than a live wound,
-- but it is the only remaining reader of that flag and it is wrong.
--
-- 0062 corrected the range overviews so an hours-less draft row stops
-- condemning a month. That fix widened a different gap: ts_list_my_days, which
-- is the employee's own History page -- the screen somebody is looking at when
-- they say "but mine says submitted" -- still counted those rows, so five
-- person-weeks now read draft to the employee and submitted to their manager.
-- Correcting one view and not its twin is how this family of bug breeds.
--
-- So the rule moves into one function that all four call. It cannot drift
-- again without being changed in the one place it lives:
--
--   nothing answered and nothing drafted -> missing
--   any draft row carrying hours         -> draft
--   otherwise                            -> submitted
--
-- A submitted row counts as an answer whether or not it carries hours, because
-- a day accounted for as empty is exactly what the team grid's hatching exists
-- to distinguish from a day nobody answered for. A draft row with no hours is
-- an empty row, not work in progress; there are seven in the table, and they
-- are left alone rather than deleted, because they are somebody's rows and the
-- rule now makes them harmless.
--
-- The grants that let this run without a session are a separate concern and
-- are dealt with in 0064.

create or replace function public.ts_period_status(
  p_answered    bigint,
  p_draft_rows  bigint)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $fn$
  -- The one definition. Callers pass how many rows were answered (submitted,
  -- with or without hours) and how many drafts actually carry hours.
  select case
           when coalesce(p_answered, 0) = 0 and coalesce(p_draft_rows, 0) = 0 then 'missing'
           when coalesce(p_draft_rows, 0) > 0                                 then 'draft'
           else 'submitted'
         end;
$fn$;

comment on function public.ts_period_status(bigint, bigint) is
  'The single rule for whether a period reads missing, draft or submitted. '
  'Every overview and the employee''s own day list call this; do not inline it.';

-- ------------------------------------------------------------------ rewiring

create or replace function public.ts_admin_range_overview(p_from date, p_to date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  work_days integer;
begin
  if not (ts_is_admin() or ts_i_manage_anyone()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 800 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  select count(*) into work_days
    from generate_series(p_from, p_to, interval '1 day') d
   where extract(dow from d) between 0 and 4;

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
               'expectedHours', round(emp.expected_weekly_hours / 5 * work_days, 2),
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
declare
  work_days integer;
begin
  -- No admin escape: this one is the reporting line or nothing.
  if not ts_i_manage_anyone() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 800 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  select count(*) into work_days
    from generate_series(p_from, p_to, interval '1 day') d
   where extract(dow from d) between 0 and 4;

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
               'expectedHours', round(emp.expected_weekly_hours / 5 * work_days, 2),
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

-- The employee's own History page. Same rule as their manager's view, so the
-- two cannot contradict each other on the same day's work.
create or replace function public.ts_list_my_days()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  emp ts_employees;
begin
  select * into emp from ts_employees where auth_user_id = auth.uid() and active;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'date', d.work_date,
             'status', d.status,
             'submittedAt', d.submitted_at,
             'totalHours', d.total,
             'billableHours', d.billable,
             'rowCount', d.rows)
             order by d.work_date desc)
      from (
        select e.work_date,
               coalesce(sum(e.hours), 0) as total,
               coalesce(sum(e.hours) filter (where e.billable), 0) as billable,
               count(*) as rows,
               ts_period_status(
                 count(*) filter (where e.status <> 'draft'),
                 count(*) filter (where e.status = 'draft' and e.hours is not null)
               ) as status,
               max(e.submitted_at) as submitted_at
          from ts_entries e
         where e.employee_id = emp.id
         group by e.work_date
      ) d), '[]'::jsonb);
end;
$function$;

-- The weekly admin view. It was the last reader of ts_weekly_submissions.status
-- and the only view that could call a week submitted while it held unfiled
-- hours. Its hours now split filed from draft the way the type it returns has
-- always claimed, which nothing could rely on before because nothing calls it.
create or replace function public.ts_admin_week_overview(p_week_start date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not ts_is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'weekStart', p_week_start,
    'employees', coalesce((
      select jsonb_agg(jsonb_build_object(
               'employeeId', emp.id, 'name', emp.full_name, 'email', emp.email,
               'markets', emp.markets, 'primaryMarket', emp.primary_market,
               'department', emp.department,
               'expectedHours', emp.expected_weekly_hours,
               'status', ts_period_status(live.answered, live.drafts),
               'totalHours', coalesce(live.filed, 0),
               'draftHours', coalesce(live.unfiled, 0),
               'submittedAt', live.last_submitted)
               order by emp.full_name)
        from ts_employees emp
        left join lateral (
               select count(*) filter (where e.status <> 'draft')                 as answered,
                      count(*) filter (where e.status = 'draft'
                                         and e.hours is not null)                 as drafts,
                      coalesce(sum(e.hours) filter (where e.status <> 'draft'), 0) as filed,
                      coalesce(sum(e.hours) filter (where e.status = 'draft'), 0)  as unfiled,
                      max(e.submitted_at)                                         as last_submitted
                 from ts_entries e
                where e.employee_id = emp.id
                  and e.work_date between p_week_start and p_week_start + 6
             ) live on true
       where emp.active and emp.onboarded_at is not null
         and emp.logs_timesheet), '[]'::jsonb));
end;
$function$;


do $$
declare bad integer;
begin
  if ts_period_status(0, 0) <> 'missing'    then raise exception 'empty period is not missing'; end if;
  if ts_period_status(0, 2) <> 'draft'      then raise exception 'drafted period is not draft'; end if;
  if ts_period_status(5, 1) <> 'draft'      then raise exception 'drafts must outrank submissions'; end if;
  if ts_period_status(5, 0) <> 'submitted'  then raise exception 'answered period is not submitted'; end if;
  if ts_period_status(null, null) <> 'missing' then raise exception 'nulls are not missing'; end if;

  -- A week whose rows are all filed but whose flag still says draft would now
  -- read submitted everywhere. There are none today; this catches the day
  -- there are, because that would mean submit stopped setting the flag.
  select count(*) into bad
    from (
      select s.employee_id, s.week_start,
             ts_period_status(
               count(x.*) filter (where x.status <> 'draft'),
               count(x.*) filter (where x.status = 'draft' and x.hours is not null)) as derived,
             s.status::text as flag
        from ts_weekly_submissions s
        left join ts_entries x on x.submission_id = s.id
       group by s.employee_id, s.week_start, s.status
    ) q
   where derived = 'submitted' and flag = 'draft';
  if bad <> 0 then raise exception '% weeks are filed but still flagged draft', bad; end if;
end $$;
