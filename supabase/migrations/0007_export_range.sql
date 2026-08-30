-- Export over an arbitrary date range.
--
-- The week export already existed for the Google Sheets path; management wants
-- a month at a time, so the range is the parameter rather than the week. The
-- week version now delegates here so both routes return identical rows.

create or replace function ts_export_range(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not ts_is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid_range' using errcode = '22023';
  end if;
  -- Bounded so a mistyped range cannot ask for the whole table.
  if (p_to - p_from) > 400 then
    raise exception 'range_too_large' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'entryId',        e.id,
             'submissionId',   s.id,
             'employeeId',     emp.id,
             'employeeName',   emp.full_name,
             'employeeEmail',  emp.email,
             'market',         e.market,
             'department',     e.department,
             'weekStart',      s.week_start,
             'weekEnd',        s.week_end,
             'workDate',       e.work_date,
             'clientId',       e.client_id,
             'clientName',     coalesce(nullif(btrim(coalesce(e.client_other, '')), ''), c.name),
             'serviceId',      e.service_id,
             'serviceName',    sv.name,
             'projectType',    e.project_type,
             'taskDescription', e.task,
             'hours',          e.hours,
             'notes',          e.project_note,
             'billable',       e.billable,
             'configuration',  emp.timesheet_configuration,
             'status',         e.status,
             'createdAt',      e.created_at,
             'updatedAt',      e.updated_at,
             'submittedAt',    e.submitted_at)
             order by e.work_date, emp.full_name, e.created_at)
      from ts_entries e
      join ts_weekly_submissions s on s.id = e.submission_id
      join ts_employees emp        on emp.id = e.employee_id
      left join ts_clients c       on c.id = e.client_id
      left join ts_services sv     on sv.id = e.service_id
     where e.work_date between p_from and p_to
       and e.status <> 'draft'), '[]'::jsonb);
end;
$$;

create or replace function ts_export_week(p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  return ts_export_range(p_week_start, p_week_start + 6);
end;
$$;

revoke all on function ts_export_range(date, date) from anon;
