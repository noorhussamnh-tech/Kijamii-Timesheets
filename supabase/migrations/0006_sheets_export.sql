-- Flattens a submitted week into the rows the Google Sheet expects.
--
-- Admin-only, and it returns submitted rows only: a draft is somebody's work
-- in progress and has no business being exported to Finance.

create or replace function ts_export_week(p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not ts_is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
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
             -- The free-text name wins when "Other" was chosen.
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
             order by emp.full_name, e.work_date, e.created_at)
      from ts_entries e
      join ts_weekly_submissions s on s.id = e.submission_id
      join ts_employees emp        on emp.id = e.employee_id
      left join ts_clients c       on c.id = e.client_id
      left join ts_services sv     on sv.id = e.service_id
     where s.week_start = p_week_start
       and e.status <> 'draft'), '[]'::jsonb);
end;
$$;

revoke all on function ts_export_week(date) from anon;
