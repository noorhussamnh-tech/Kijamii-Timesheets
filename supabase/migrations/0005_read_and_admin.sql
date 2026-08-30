-- Read paths and admin operations.
--
-- The week view is one function returning one JSON document so opening a week
-- is a single round trip rather than four queries the client has to stitch.

create or replace function ts_get_week(p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  emp ts_employees;
  sub ts_weekly_submissions;
begin
  select * into emp from ts_employees
   where auth_user_id = auth.uid() and active;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;

  select * into sub from ts_weekly_submissions
   where employee_id = emp.id and week_start = p_week_start;

  return jsonb_build_object(
    'weekStart', p_week_start,
    'submission', case when sub.id is null then null else jsonb_build_object(
        'id', sub.id, 'status', sub.status, 'revision', sub.draft_revision,
        'submittedAt', sub.submitted_at, 'updatedAt', sub.updated_at,
        'totalHours', sub.total_hours, 'billableHours', sub.billable_hours,
        'nonBillableHours', sub.non_billable_hours,
        'expectedHours', sub.expected_hours, 'missingHours', sub.missing_hours)
      end,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'workDate', e.work_date, 'clientId', e.client_id,
               'clientOther', e.client_other, 'serviceId', e.service_id,
               'projectType', e.project_type, 'task', e.task,
               'projectNote', e.project_note, 'hours', e.hours,
               'billable', e.billable, 'status', e.status, 'market', e.market)
               order by e.work_date, e.created_at)
        from ts_entries e where e.submission_id = sub.id), '[]'::jsonb),
    'lockedDays', coalesce((
      select jsonb_agg(dl.work_date order by dl.work_date)
        from ts_day_locks dl where dl.submission_id = sub.id), '[]'::jsonb)
  );
end;
$$;

-- History for the signed-in employee. Never returns anybody else's weeks.
create or replace function ts_list_my_submissions()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  emp ts_employees;
begin
  select * into emp from ts_employees where auth_user_id = auth.uid() and active;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'weekStart', s.week_start, 'weekEnd', s.week_end,
             'status', s.status, 'submittedAt', s.submitted_at,
             'totalHours', live.total, 'billableHours', live.billable,
             'expectedHours', s.expected_hours)
             order by s.week_start desc)
      from ts_weekly_submissions s
      cross join lateral (
        select coalesce(sum(e.hours), 0) as total,
               coalesce(sum(e.hours) filter (where e.billable), 0) as billable
          from ts_entries e where e.submission_id = s.id
      ) live
     where s.employee_id = emp.id), '[]'::jsonb);
end;
$$;

-- ------------------------------------------------------------------- admin

-- Every admin function re-checks the caller's role in the database. Reaching
-- an admin URL directly is not enough; the data layer refuses.
create or replace function ts_admin_week_overview(p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
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
               'status', coalesce(s.status::text, 'missing'),
               'totalHours', coalesce(live.total, 0),
               'submittedAt', s.submitted_at)
               order by emp.full_name)
        from ts_employees emp
        left join ts_weekly_submissions s
               on s.employee_id = emp.id and s.week_start = p_week_start
        left join lateral (
               select coalesce(sum(e.hours), 0) as total
                 from ts_entries e where e.submission_id = s.id
             ) live on true
       where emp.active and emp.onboarded_at is not null), '[]'::jsonb));
end;
$$;

create or replace function ts_admin_update_employee(
  p_employee_id    uuid,
  p_markets        ts_market[],
  p_primary_market ts_market,
  p_department     text,
  p_expected_hours numeric,
  p_role           ts_role,
  p_active         boolean
) returns ts_employees
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor ts_employees;
  emp   ts_employees;
begin
  select * into actor from ts_employees where auth_user_id = auth.uid() and active;
  if not found or actor.role <> 'admin' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_primary_market is not null
     and (p_markets is null or not (p_primary_market = any (p_markets))) then
    raise exception 'invalid_primary_market' using errcode = '22023';
  end if;
  -- An admin cannot remove their own admin rights and lock everyone out.
  if p_employee_id = actor.id and p_role <> 'admin' then
    raise exception 'cannot_demote_self' using errcode = '22023';
  end if;

  update ts_employees
     set markets                 = coalesce(p_markets, markets),
         primary_market          = coalesce(p_primary_market, primary_market),
         department              = nullif(btrim(coalesce(p_department, '')), ''),
         expected_weekly_hours   = coalesce(p_expected_hours, expected_weekly_hours),
         role                    = coalesce(p_role, role),
         active                  = coalesce(p_active, active),
         timesheet_configuration = case
             when coalesce(p_primary_market, primary_market) = 'KSA' then 'KSA'::ts_config
             when coalesce(p_primary_market, primary_market) is null then timesheet_configuration
             else 'EG_UAE'::ts_config end,
         onboarded_at            = coalesce(onboarded_at,
                                     case when coalesce(p_primary_market, primary_market) is not null
                                          then now() end),
         updated_at              = now()
   where id = p_employee_id
  returning * into emp;

  if not found then
    raise exception 'employee_not_found' using errcode = '02000';
  end if;

  insert into ts_audit_log (actor_email, action, record_type, record_id, details)
  values (actor.email, 'employee.updated', 'employee', emp.id::text,
          jsonb_build_object('markets', emp.markets, 'primary_market', emp.primary_market,
                             'role', emp.role, 'active', emp.active));

  return emp;
end;
$$;

-- Returning a week to an employee. The status value already exists in the
-- enum, so no data migration is needed to switch this on properly later.
create or replace function ts_admin_reopen_week(p_employee_id uuid, p_week_start date, p_note text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor ts_employees;
  sub   ts_weekly_submissions;
begin
  select * into actor from ts_employees where auth_user_id = auth.uid() and active;
  if not found or actor.role <> 'admin' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into sub from ts_weekly_submissions
   where employee_id = p_employee_id and week_start = p_week_start for update;
  if not found then raise exception 'submission_not_found' using errcode = '02000'; end if;

  update ts_weekly_submissions
     set status = 'draft', submitted_at = null, updated_at = now()
   where id = sub.id;
  update ts_entries
     set status = 'draft', submitted_at = null, updated_at = now()
   where submission_id = sub.id;
  delete from ts_day_locks where submission_id = sub.id;

  insert into ts_audit_log (actor_email, action, record_type, record_id, details)
  values (actor.email, 'week.reopened', 'submission', sub.id::text,
          jsonb_build_object('week_start', p_week_start, 'note', p_note,
                             'employee_id', p_employee_id));

  return jsonb_build_object('ok', true, 'submissionId', sub.id);
end;
$$;

-- ------------------------------------------------------------ grants

-- Anonymous callers get nothing; every function above resolves the caller
-- from their JWT and refuses when there isn't one.
revoke all on function ts_save_draft(date, jsonb, bigint) from anon;
revoke all on function ts_submit_week(date) from anon;
revoke all on function ts_submit_day(date, date) from anon;
revoke all on function ts_get_week(date) from anon;
revoke all on function ts_list_my_submissions() from anon;
revoke all on function ts_complete_onboarding(ts_market[], ts_market, text, numeric) from anon;
revoke all on function ts_admin_week_overview(date) from anon;
revoke all on function ts_admin_update_employee(uuid, ts_market[], ts_market, text, numeric, ts_role, boolean) from anon;
revoke all on function ts_admin_reopen_week(uuid, date, text) from anon;
