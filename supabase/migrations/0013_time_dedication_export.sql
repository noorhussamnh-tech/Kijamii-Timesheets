-- Feed for the "Egypt & UAE Time Dedication" tab in the agency job book.
--
-- The sheet is wide (a column per month); this returns the long form of it —
-- one row per person, brand and month — so each cell in the sheet is a lookup
-- rather than a number somebody retypes. The join key is built from codes,
-- not names, because names drift: an employee is renamed, a client is
-- rebranded, and every formula that matched on the old spelling goes silent.
--
-- KSA is excluded on purpose: that market does not keep timesheets, so there
-- is no equivalent tab to fill.
--
-- The export is roster-complete. Every active employee who could log EG or UAE
-- time appears, including people who logged nothing in the range: those come
-- back as a single row with no brand, no month and zero hours, so the sheet's
-- name column stays the full team and a blank row reads as "logged nothing"
-- rather than "not in the export". Employees are omitted only when they are
-- inactive or work KSA alone; someone who has not onboarded yet has no market
-- on record, so they are kept rather than guessed away.

create or replace function ts_export_time_dedication(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not ts_is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 800 then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  return coalesce((
    with roster as (
      select emp.*
        from ts_employees emp
       where emp.active
         and (cardinality(emp.markets) = 0
              or emp.markets && array['EG', 'UAE']::ts_market[])
    ),
    logged as (
      select e.employee_id,
             e.client_id,
             e.market::text as market,
             coalesce(nullif(btrim(coalesce(e.client_other, '')), ''), cl.name) as brand_name,
             to_char(date_trunc('month', e.work_date), 'YYYY-MM') as month,
             sum(e.hours) as hours
        from ts_entries e
        left join ts_clients cl on cl.id = e.client_id
       where e.work_date between p_from and p_to
         and e.status <> 'draft'
         and e.hours is not null
         and e.market in ('EG', 'UAE')
       group by 1, 2, 3, 4, 5
    ),
    rows_out as (
      select emp.full_name,
             emp.employee_code,
             emp.department,
             agg.market,
             c.client_code,
             agg.brand_name,
             agg.month,
             agg.hours,
             coalesce(emp.employee_code, lower(emp.full_name))
               || '|' || coalesce(c.client_code, lower(agg.brand_name))
               || '|' || agg.month as lookup_key
        from logged agg
        join roster emp on emp.id = agg.employee_id
        left join ts_clients c on c.id = agg.client_id

      union all

      -- People with nothing logged in the range still belong on the roster.
      select emp.full_name,
             emp.employee_code,
             emp.department,
             case when emp.primary_market in ('EG', 'UAE')
                  then emp.primary_market::text end,
             null, null, null,
             0::numeric,
             null
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
$$;

comment on function ts_export_time_dedication(date, date) is
  'Admin-only. Long form of the Egypt & UAE Time Dedication tab: every active EG/UAE employee, with one row per brand and month they logged time against, or a single zero row when they logged nothing.';

-- Employee codes are the stable half of the lookup key. They are set by an
-- admin rather than chosen by the employee, so they can be kept in step with
-- whatever identifier the job book already uses.
create or replace function ts_admin_set_employee_code(p_employee_id uuid, p_code text)
returns ts_employees
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

  update ts_employees
     set employee_code = nullif(btrim(coalesce(p_code, '')), ''),
         updated_at    = now()
   where id = p_employee_id
  returning * into emp;

  if not found then raise exception 'employee_not_found' using errcode = '02000'; end if;

  insert into ts_audit_log (actor_email, action, record_type, record_id, details)
  values (actor.email, 'employee.code_set', 'employee', emp.id::text,
          jsonb_build_object('employee_code', emp.employee_code));

  return emp;
end;
$$;
