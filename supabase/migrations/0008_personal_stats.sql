-- Personal statistics for the "wrapped" view.
--
-- Scoped to the caller and nobody else: the employee is resolved from
-- auth.uid(), never from a parameter, so there is no way to ask for a
-- colleague's numbers by changing a request.

create or replace function ts_my_stats(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  emp        ts_employees;
  span       integer;
  prev_from  date;
  prev_to    date;
  result     jsonb;
begin
  select * into emp from ts_employees
   where auth_user_id = auth.uid() and active;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;

  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid_range' using errcode = '22023';
  end if;
  if (p_to - p_from) > 400 then
    raise exception 'range_too_large' using errcode = '22023';
  end if;

  -- The immediately preceding window of equal length, for comparison.
  span      := (p_to - p_from) + 1;
  prev_to   := p_from - 1;
  prev_from := prev_to - (span - 1);

  with mine as (
    select e.*
      from ts_entries e
     where e.employee_id = emp.id
       and e.work_date between p_from and p_to
       and e.hours is not null
  ),
  by_day as (
    select work_date, sum(hours) as hours from mine group by work_date
  ),
  -- Consecutive calendar days with something logged: the date minus its
  -- row number is constant within a run, which groups the runs.
  streaks as (
    select count(*) as len
      from (
        select work_date,
               work_date - (row_number() over (order by work_date))::integer as grp
          from by_day
      ) g
     group by grp
  ),
  -- Aggregation happens in these, so the JSON above is built from finished
  -- values rather than grouping by an expression containing an aggregate.
  per_client as (
    select coalesce(nullif(btrim(coalesce(m.client_other, '')), ''), c.name) as name,
           sum(m.hours) as hours
      from mine m
      left join ts_clients c on c.id = m.client_id
     group by 1
  ),
  per_service as (
    select sv.name as name, sum(m.hours) as hours
      from mine m join ts_services sv on sv.id = m.service_id
     group by 1
  ),
  per_task as (
    select m.task as name, sum(m.hours) as hours
      from mine m
     where nullif(btrim(coalesce(m.task, '')), '') is not null
     group by 1
  ),
  per_weekday as (
    select extract(dow from work_date)::int as dow, sum(hours) as hours
      from mine group by 1
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'totalHours',      coalesce((select sum(hours) from mine), 0),
    'billableHours',   coalesce((select sum(hours) from mine where billable), 0),
    'entryCount',      (select count(*) from mine),
    'daysLogged',      (select count(*) from by_day),
    'distinctClients', (select count(distinct coalesce(client_id::text, lower(client_other))) from mine),
    'distinctServices',(select count(distinct service_id) from mine),
    'longestStreak',   coalesce((select max(len) from streaks), 0),
    'busiestDay',      (select jsonb_build_object('date', work_date, 'hours', hours)
                          from by_day order by hours desc, work_date limit 1),
    'topClient',       (select jsonb_build_object('name', name, 'hours', hours)
                          from per_client order by hours desc nulls last limit 1),
    'topService',      (select jsonb_build_object('name', name, 'hours', hours)
                          from per_service order by hours desc nulls last limit 1),
    'topTask',         (select jsonb_build_object('name', name, 'hours', hours)
                          from per_task order by hours desc nulls last limit 1),
    'clients',         coalesce((select jsonb_agg(jsonb_build_object('name', name, 'hours', hours)
                                                  order by hours desc)
                          from (select name, hours from per_client
                                 order by hours desc nulls last limit 8) t), '[]'::jsonb),
    'byWeekday',       coalesce((select jsonb_agg(jsonb_build_object('dow', dow, 'hours', hours)
                                                  order by dow)
                          from per_weekday), '[]'::jsonb),
    'previousTotal',   coalesce((select sum(e.hours) from ts_entries e
                                  where e.employee_id = emp.id
                                    and e.work_date between prev_from and prev_to
                                    and e.hours is not null), 0),
    'expectedWeeklyHours', emp.expected_weekly_hours
  ) into result;

  return result;
end;
$$;

revoke all on function ts_my_stats(date, date) from anon;
