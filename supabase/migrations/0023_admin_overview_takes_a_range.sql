-- 0023: the overview stops being tied to one week.
--
-- A week was the only period it could show, so an admin asking "what did
-- August look like" had to step through four weeks and add them up -- and
-- every export hung off the same control, so they could not be asked for a
-- campaign, a notice period, or a fortnight somebody was away either.
--
-- It takes any two dates now. A single week, still the default, reads exactly
-- as it did. ts_admin_week_overview is left in place, unused, rather than
-- dropped in the same change that replaces it.
create or replace function public.ts_admin_range_overview(p_from date, p_to date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  work_days integer;
begin
  if not ts_is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 800 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  /*
   * Expected hours have to scale with the period or the comparison is
   * meaningless -- 40 against a month reads as everybody being wildly over.
   *
   * Counted in working days rather than by dividing the span by seven, so a
   * fortnight that happens to carry an extra weekend is not credited with
   * hours nobody was expected to work. Sunday to Thursday, which is the
   * working week in both Egypt and Saudi Arabia.
   */
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
               'expectedHours', round(emp.expected_weekly_hours / 5 * work_days, 2),
               -- Drafts outrank submissions: a period holding one unfinished
               -- row is not finished, however many finished ones sit beside it.
               'status', case
                           when live.rows = 0        then 'missing'
                           when live.drafts > 0      then 'draft'
                           else 'submitted'
                         end,
               'totalHours', coalesce(live.total, 0),
               'submittedAt', live.last_submitted)
               order by emp.full_name)
        from ts_employees emp
        left join lateral (
               select count(*)                                   as rows,
                      count(*) filter (where e.status = 'draft') as drafts,
                      coalesce(sum(e.hours), 0)                  as total,
                      max(e.submitted_at)                        as last_submitted
                 from ts_entries e
                where e.employee_id = emp.id
                  and e.work_date between p_from and p_to
             ) live on true
       where emp.active and emp.onboarded_at is not null
         and emp.logs_timesheet), '[]'::jsonb));
end;
$function$;

grant execute on function public.ts_admin_range_overview(date, date) to authenticated;
