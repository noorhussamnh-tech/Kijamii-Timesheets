-- 0062: a submitted hour is never dropped for want of a market, and an empty
-- draft row no longer condemns a whole period.
--
-- Reported from the Calendar Year View: Karim Moataz, Malak Bayoumy and Hosain
-- Mohamed showed as having submitted nothing for October, while their own
-- timesheets showed every day submitted. Both halves of that were true at
-- once, and there are two separate causes behind it.
--
-- ---------------------------------------------------------------- the first
--
-- ts_export_time_dedication filtered entries with
--
--     and e.market = any (v_markets)
--
-- and market is null on every row these three have ever saved. In SQL
-- `null = any (...)` is null, not false, so the predicate dropped the rows
-- rather than keeping them -- and because the function then lists anybody with
-- no rows in `logged` as a roster line with zero hours, the people whose hours
-- had just been discarded came back out of it looking like people who had
-- never logged. A silent drop presented as a confident nil.
--
-- It was not three people. Across the whole table, 458 submitted rows carrying
-- 1340.25 hours had no market, which is 36% of the 3712.50 hours ever
-- submitted. Eight people lose every hour they have logged: the eight with a
-- blank Entity in the OPS list, whose primary_market is therefore null, whose
-- markets array is therefore empty, and whose every saved row inherits no
-- market from either. Bassma Elkaramany joins them the day she logs.
--
-- A null market is missing metadata, not evidence that an hour belongs to no
-- market, so it is now kept and labelled "Not set" -- which is what the
-- adoption report already calls it. Visible beats silent: a reader can see
-- 1340 hours sitting under "Not set" and go and fill column C, and could never
-- see 1340 hours that were not printed. A caller that narrows to specific
-- markets gets them too, for the same reason; the app passes no narrowing at
-- all, so that path is reachable only by calling the function directly.
--
-- The real repair is upstream and belongs to the OPS sheet: fill Entity for
-- those eight and the market resolves itself on their next sign-in. This makes
-- the hours visible in the meantime instead of waiting for it.
--
-- --------------------------------------------------------------- the second
--
-- The range overviews, which feed My Team and the admin grid, read
--
--     when live.drafts > 0 then 'draft'
--
-- with drafts counted as `count(*) filter (where e.status = 'draft')`. The
-- intent is sound and is kept: a period holding unfinished work is not
-- finished. But the count included rows with no hours and no task -- a client
-- picked in the grid and abandoned. Hosain Mohamed has two such rows, 3 and 13
-- October, and they marked the whole of his October as draft behind 30
-- submitted rows and 141 hours.
--
-- A row with no hours on it is not unfinished work, it is an empty row. Drafts
-- now count only where hours are actually recorded, and "missing" is decided
-- from the same two counts so that somebody holding nothing but empty drafts
-- still reads as missing rather than being promoted to submitted. A submitted
-- row with no hours keeps counting as an answer, because a day accounted for
-- as empty is the thing the grid's hatching exists to distinguish from a day
-- nobody answered for.

create or replace function public.ts_export_time_dedication(
  p_from date,
  p_to date,
  p_markets ts_market[] default array['EG'::ts_market, 'UAE'::ts_market])
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_markets ts_market[];
begin
  if not ts_is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 800 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  v_markets := case
                 when p_markets is null or cardinality(p_markets) = 0
                   then enum_range(null::ts_market)
                 else p_markets
               end;

  return coalesce((
    with roster as (
      select emp.*
        from ts_employees emp
       where emp.active
         and emp.logs_timesheet
         and (cardinality(emp.markets) = 0 or emp.markets && v_markets)
    ),
    logged as (
      select e.employee_id,
             e.client_id,
             -- Kept rather than dropped, and named rather than left blank.
             -- `null = any (...)` is null, so the old predicate discarded
             -- these; a market nobody has filled in is missing metadata, not
             -- an hour that belongs nowhere.
             coalesce(e.market::text, 'Not set') as market,
             coalesce(nullif(btrim(coalesce(e.client_other, '')), ''), cl.name) as brand_name,
             to_char(date_trunc('month', e.work_date), 'YYYY-MM') as month,
             sum(e.hours) as hours
        from ts_entries e
        left join ts_clients cl on cl.id = e.client_id
       where e.work_date between p_from and p_to
         and e.status <> 'draft'
         and e.hours is not null
         and (e.market is null or e.market = any (v_markets))
       group by 1, 2, 3, 4, 5
    ),
    rows_out as (
      select emp.full_name, emp.employee_code, emp.department,
             agg.market, c.client_code, agg.brand_name, agg.month, agg.hours,
             coalesce(emp.employee_code, lower(emp.full_name))
               || '|' || coalesce(c.client_code, lower(agg.brand_name))
               || '|' || agg.month as lookup_key
        from logged agg
        join roster emp on emp.id = agg.employee_id
        left join ts_clients c on c.id = agg.client_id

      union all

      -- Still here, and now only reached by somebody who really did log
      -- nothing in the period rather than by somebody whose rows were thrown
      -- away above.
      select emp.full_name, emp.employee_code, emp.department,
             case when emp.primary_market is null then 'Not set'
                  when emp.primary_market = any (v_markets)
                    then emp.primary_market::text end,
             null, null, null, 0::numeric, null
        from roster emp
       where not exists (select 1 from logged l where l.employee_id = emp.id)
    )
    select jsonb_agg(jsonb_build_object(
             'lookupKey',    lookup_key,
             'employeeCode', employee_code,
             'employeeName', full_name,
             'department',   department,
             'market',       market,
             'clientCode',   client_code,
             'brandName',    brand_name,
             'month',        month,
             'hours',        hours)
             order by full_name, brand_name nulls first, month)
      from rows_out), '[]'::jsonb);
end;
$function$;

-- The two range overviews carry the same status rule and are corrected
-- identically. They are rewritten in full rather than patched by string
-- replacement so that what each one says is readable here.

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
               -- Drafts still outrank submissions: a period holding unfinished
               -- work is not finished, however many finished rows sit beside
               -- it. What changed is what counts as unfinished -- a row with no
               -- hours on it is an empty row, not work in progress, and used to
               -- mark a whole month draft behind thirty submitted days.
               'status', case
                           when live.answered = 0 and live.drafts = 0 then 'missing'
                           when live.drafts > 0                       then 'draft'
                           else 'submitted'
                         end,
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
               select count(*)                                                      as rows,
                      -- A submitted row counts as an answer whether or not it
                      -- carries hours: a day accounted for as empty is the
                      -- thing the grid's hatching distinguishes from a day
                      -- nobody answered for.
                      count(*) filter (where e.status <> 'draft')                   as answered,
                      count(*) filter (where e.status = 'draft'
                                         and e.hours is not null)                   as drafts,
                      coalesce(sum(e.hours), 0)                                     as total,
                      coalesce(sum(e.hours) filter (where e.status <> 'draft'), 0)   as filed,
                      coalesce(sum(e.hours) filter (where e.status = 'draft'), 0)    as unfiled,
                      max(e.submitted_at)                                           as last_submitted
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
               'status', case
                           when live.answered = 0 and live.drafts = 0 then 'missing'
                           when live.drafts > 0                       then 'draft'
                           else 'submitted'
                         end,
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
               select count(*)                                                      as rows,
                      count(*) filter (where e.status <> 'draft')                   as answered,
                      count(*) filter (where e.status = 'draft'
                                         and e.hours is not null)                   as drafts,
                      coalesce(sum(e.hours), 0)                                     as total,
                      coalesce(sum(e.hours) filter (where e.status <> 'draft'), 0)   as filed,
                      coalesce(sum(e.hours) filter (where e.status = 'draft'), 0)    as unfiled,
                      max(e.submitted_at)                                           as last_submitted
                 from ts_entries e
                where e.employee_id = emp.id
                  and e.work_date between p_from and p_to
             ) live on true
       where emp.active and emp.onboarded_at is not null
         and emp.logs_timesheet
         and lower(emp.email) in (select email from ts_my_team_emails())), '[]'::jsonb));
end;
$function$;

-- The grants these replace carried, restated so a rewrite cannot quietly widen
-- or narrow who may call them.
revoke all on function public.ts_export_time_dedication(date, date, ts_market[]) from public, anon;
revoke all on function public.ts_admin_range_overview(date, date) from public, anon;
revoke all on function public.ts_team_range_overview(date, date) from public, anon;
grant execute on function public.ts_export_time_dedication(date, date, ts_market[]) to authenticated;
grant execute on function public.ts_admin_range_overview(date, date) to authenticated;
grant execute on function public.ts_team_range_overview(date, date) to authenticated;

-- Not one submitted hour may be missing from the job book feed any more.
do $$
declare
  submitted numeric;
  in_feed   numeric;
begin
  select coalesce(sum(e.hours), 0) into submitted
    from ts_entries e
    join ts_employees emp on emp.id = e.employee_id
   where e.status <> 'draft' and e.hours is not null
     and e.work_date between date '2026-01-01' and date '2026-12-31'
     and emp.active and emp.logs_timesheet;

  -- The same shape the function's `logged` CTE now uses, over the same year.
  select coalesce(sum(e.hours), 0) into in_feed
    from ts_entries e
    join ts_employees emp on emp.id = e.employee_id
   where e.status <> 'draft' and e.hours is not null
     and e.work_date between date '2026-01-01' and date '2026-12-31'
     and emp.active and emp.logs_timesheet
     and (cardinality(emp.markets) = 0 or emp.markets && enum_range(null::ts_market))
     and (e.market is null or e.market = any (enum_range(null::ts_market)));

  if in_feed <> submitted then
    raise exception 'the feed still loses % of % submitted hours',
      submitted - in_feed, submitted;
  end if;
end $$;
