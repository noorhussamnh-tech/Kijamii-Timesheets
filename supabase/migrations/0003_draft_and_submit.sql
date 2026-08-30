-- Draft persistence and submission, as database functions.
--
-- All writes go through these functions rather than through table-level DML so
-- that "save a draft" and "submit a week" are each a single transaction. A
-- half-written week is not a state this schema can reach.

-- A draft has to round-trip exactly what the person typed, including rows they
-- have not finished. So hours are nullable while the row is a draft, and
-- required the moment it is submitted.
alter table ts_entries alter column hours drop not null;

alter table ts_entries drop constraint ts_entries_hours_positive;
alter table ts_entries drop constraint ts_entries_hours_max_day;
alter table ts_entries drop constraint ts_entries_hours_quarter;

alter table ts_entries add constraint ts_entries_hours_valid check (
  hours is null or (hours > 0 and hours <= 24 and mod(hours * 4, 1) = 0)
);

-- Nothing incomplete can carry a non-draft status.
alter table ts_entries add constraint ts_entries_submitted_is_complete check (
  status = 'draft' or (
    hours is not null and work_date is not null and service_id is not null
    and (client_id is not null or nullif(btrim(coalesce(client_other, '')), '') is not null)
  )
);

-- Monotonic counter used to reject an autosave that raced ahead of a newer one.
alter table ts_weekly_submissions
  add column draft_revision bigint not null default 0;

-- ------------------------------------------------------------- onboarding

create or replace function ts_complete_onboarding(
  p_markets        ts_market[],
  p_primary_market ts_market,
  p_department     text,
  p_expected_hours numeric default 40
) returns ts_employees
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  emp ts_employees;
begin
  select * into emp from ts_employees where auth_user_id = auth.uid() for update;

  if not found then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not emp.active then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  -- Onboarding sets the market once. Changing it afterwards is an admin action.
  if emp.onboarded_at is not null then
    raise exception 'already_onboarded' using errcode = '22023';
  end if;
  if p_markets is null or cardinality(p_markets) = 0 then
    raise exception 'markets_required' using errcode = '22023';
  end if;
  if p_primary_market is null or not (p_primary_market = any (p_markets)) then
    raise exception 'invalid_primary_market' using errcode = '22023';
  end if;
  if p_expected_hours is null or p_expected_hours <= 0 or p_expected_hours > 168 then
    raise exception 'invalid_expected_hours' using errcode = '22023';
  end if;

  update ts_employees
     set markets                 = p_markets,
         primary_market          = p_primary_market,
         department              = nullif(btrim(coalesce(p_department, '')), ''),
         expected_weekly_hours   = p_expected_hours,
         -- KSA-only staff get the KSA configuration; anyone spanning markets
         -- follows their primary market.
         timesheet_configuration = case when p_primary_market = 'KSA'
                                        then 'KSA'::ts_config
                                        else 'EG_UAE'::ts_config end,
         onboarded_at            = now(),
         updated_at              = now()
   where id = emp.id
  returning * into emp;

  insert into ts_audit_log (actor_email, action, record_type, record_id, details)
  values (emp.email, 'onboarding.completed', 'employee', emp.id::text,
          jsonb_build_object('markets', p_markets, 'primary_market', p_primary_market,
                             'department', emp.department));

  return emp;
end;
$$;

-- --------------------------------------------------------------- draft save

-- Upserts a whole week of draft rows in one transaction. Rows absent from the
-- payload are deleted, so the sheet in the browser and the sheet in the
-- database always agree; rows on a locked day are left untouched.
create or replace function ts_save_draft(
  p_week_start date,
  p_entries    jsonb,
  p_revision   bigint
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  emp      ts_employees;
  sub      ts_weekly_submissions;
  kept     uuid[];
  item     jsonb;
  v_market ts_market;
  v_client uuid;
begin
  select * into emp from ts_employees
   where auth_user_id = auth.uid() and active and onboarded_at is not null;
  if not found then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if extract(dow from p_week_start) <> 0 then
    raise exception 'week_must_start_sunday' using errcode = '22023';
  end if;
  -- A week that has not begun cannot be filled in.
  if p_week_start > (current_date + 6) then
    raise exception 'future_week' using errcode = '22023';
  end if;

  insert into ts_weekly_submissions (employee_id, week_start, expected_hours)
  values (emp.id, p_week_start, emp.expected_weekly_hours)
  on conflict (employee_id, week_start) do nothing;

  select * into sub from ts_weekly_submissions
   where employee_id = emp.id and week_start = p_week_start
   for update;

  if sub.status <> 'draft' then
    raise exception 'week_already_submitted' using errcode = '23505';
  end if;

  -- Reject an autosave that lost a race with a newer one.
  if p_revision is not null and p_revision <= sub.draft_revision then
    return jsonb_build_object('stale', true, 'revision', sub.draft_revision);
  end if;

  kept := array(select (e ->> 'id')::uuid
                  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e
                 where e ->> 'id' is not null);

  delete from ts_entries en
   where en.submission_id = sub.id
     and not (en.id = any (kept))
     and not exists (
       select 1 from ts_day_locks dl
        where dl.submission_id = en.submission_id and dl.work_date = en.work_date
     );

  for item in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb))
  loop
    v_client := nullif(item ->> 'client_id', '')::uuid;

    -- The market stamped on the row is derived from the client, never taken
    -- from the browser. A client tied to one of the employee's own markets
    -- wins; otherwise the row falls back to their primary market.
    if v_client is null then
      v_market := emp.primary_market;
    else
      select case
               when cardinality(c.markets) = 0            then emp.primary_market
               when emp.primary_market = any (c.markets)  then emp.primary_market
               else (select m from unnest(c.markets) m where m = any (emp.markets) limit 1)
             end
        into v_market
        from ts_clients c
       where c.id = v_client;

      v_market := coalesce(v_market, emp.primary_market);
    end if;

    insert into ts_entries (
      id, submission_id, week_start, employee_id, work_date,
      client_id, client_other, service_id, project_type, task, project_note,
      hours, billable, market, department, status
    ) values (
      coalesce(nullif(item ->> 'id', '')::uuid, gen_random_uuid()),
      sub.id, p_week_start, emp.id,
      (item ->> 'work_date')::date,
      v_client,
      nullif(btrim(coalesce(item ->> 'client_other', '')), ''),
      nullif(item ->> 'service_id', '')::uuid,
      nullif(btrim(coalesce(item ->> 'project_type', '')), ''),
      nullif(btrim(coalesce(item ->> 'task', '')), ''),
      nullif(btrim(coalesce(item ->> 'project_note', '')), ''),
      nullif(item ->> 'hours', '')::numeric,
      coalesce((item ->> 'billable')::boolean, true),
      v_market,
      emp.department,
      'draft'
    )
    on conflict (id) do update set
      work_date    = excluded.work_date,
      client_id    = excluded.client_id,
      client_other = excluded.client_other,
      service_id   = excluded.service_id,
      project_type = excluded.project_type,
      task         = excluded.task,
      project_note = excluded.project_note,
      hours        = excluded.hours,
      billable     = excluded.billable,
      market       = excluded.market,
      updated_at   = now()
    where ts_entries.employee_id = emp.id
      and ts_entries.status = 'draft'
      and not exists (
        select 1 from ts_day_locks dl
         where dl.submission_id = ts_entries.submission_id
           and dl.work_date = ts_entries.work_date
      );
  end loop;

  update ts_weekly_submissions
     set draft_revision = coalesce(p_revision, draft_revision + 1),
         updated_at     = now()
   where id = sub.id
  returning * into sub;

  return jsonb_build_object(
    'stale', false,
    'submission_id', sub.id,
    'revision', sub.draft_revision,
    'saved_at', sub.updated_at
  );
end;
$$;

-- ------------------------------------------------------------- validation

-- Shared server-side gate. The browser runs the same rules for fast feedback,
-- but this is the copy that decides.
create or replace function ts_validate_week(p_submission uuid, p_scope date default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  problems jsonb := '[]'::jsonb;
  n_rows   integer;
  bad      record;
begin
  select count(*) into n_rows
    from ts_entries e
   where e.submission_id = p_submission
     and (p_scope is null or e.work_date = p_scope);

  if n_rows = 0 then
    return jsonb_build_array(jsonb_build_object('code', 'no_entries',
      'message', 'Add at least one entry before submitting.'));
  end if;

  -- Incomplete rows, reported per row so the UI can highlight them.
  for bad in
    select e.id, e.work_date,
           array_remove(array[
             case when e.hours is null then 'hours' end,
             case when e.service_id is null then 'service' end,
             case when e.client_id is null
                   and nullif(btrim(coalesce(e.client_other, '')), '') is null
                  then 'client' end,
             case when nullif(btrim(coalesce(e.project_type, '')), '') is null then 'projectType' end,
             case when nullif(btrim(coalesce(e.task, '')), '') is null then 'task' end
           ], null) as missing
      from ts_entries e
     where e.submission_id = p_submission
       and (p_scope is null or e.work_date = p_scope)
  loop
    if array_length(bad.missing, 1) > 0 then
      problems := problems || jsonb_build_object(
        'code', 'incomplete_row', 'entryId', bad.id, 'fields', to_jsonb(bad.missing),
        'message', 'Complete every required field on this row.');
    end if;
  end loop;

  -- A day cannot exceed 24 hours in total, however it is split across rows.
  for bad in
    select e.work_date, sum(e.hours) as total
      from ts_entries e
     where e.submission_id = p_submission
       and (p_scope is null or e.work_date = p_scope)
     group by e.work_date having sum(e.hours) > 24
  loop
    problems := problems || jsonb_build_object(
      'code', 'day_over_24h', 'date', bad.work_date,
      'message', format('%s totals %s hours, which is more than a day.',
                        to_char(bad.work_date, 'FMDay DD Mon'), bad.total));
  end loop;

  -- Nothing may be logged against a day that has not happened yet.
  for bad in
    select distinct e.work_date
      from ts_entries e
     where e.submission_id = p_submission
       and (p_scope is null or e.work_date = p_scope)
       and e.work_date > current_date
  loop
    problems := problems || jsonb_build_object(
      'code', 'future_date', 'date', bad.work_date,
      'message', 'You cannot log hours against a future date.');
  end loop;

  return problems;
end;
$$;

-- ---------------------------------------------------------------- submit

-- Freezes a single day. The rest of the week stays editable.
create or replace function ts_submit_day(p_week_start date, p_work_date date)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  emp      ts_employees;
  sub      ts_weekly_submissions;
  problems jsonb;
begin
  select * into emp from ts_employees
   where auth_user_id = auth.uid() and active and onboarded_at is not null;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;

  select * into sub from ts_weekly_submissions
   where employee_id = emp.id and week_start = p_week_start
   for update;
  if not found then raise exception 'no_draft' using errcode = '02000'; end if;
  if sub.status <> 'draft' then
    raise exception 'week_already_submitted' using errcode = '23505';
  end if;
  if p_work_date < p_week_start or p_work_date > p_week_start + 6 then
    raise exception 'date_outside_week' using errcode = '22023';
  end if;

  -- Idempotent: submitting an already-locked day returns the existing result.
  if exists (select 1 from ts_day_locks
              where submission_id = sub.id and work_date = p_work_date) then
    return jsonb_build_object('alreadySubmitted', true, 'date', p_work_date);
  end if;

  problems := ts_validate_week(sub.id, p_work_date);
  if jsonb_array_length(problems) > 0 then
    return jsonb_build_object('ok', false, 'problems', problems);
  end if;

  insert into ts_day_locks (submission_id, work_date) values (sub.id, p_work_date);

  update ts_entries
     set status = 'submitted', submitted_at = now(), updated_at = now()
   where submission_id = sub.id and work_date = p_work_date;

  insert into ts_audit_log (actor_email, action, record_type, record_id, details)
  values (emp.email, 'day.submitted', 'submission', sub.id::text,
          jsonb_build_object('week_start', p_week_start, 'work_date', p_work_date));

  return jsonb_build_object('ok', true, 'date', p_work_date, 'submittedAt', now());
end;
$$;

-- Submits the whole week. Idempotent by construction: a week that is already
-- submitted returns its existing record instead of writing a second one.
create or replace function ts_submit_week(p_week_start date)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  emp      ts_employees;
  sub      ts_weekly_submissions;
  problems jsonb;
  t_total  numeric := 0;
  t_bill   numeric := 0;
begin
  select * into emp from ts_employees
   where auth_user_id = auth.uid() and active and onboarded_at is not null;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;

  -- Serialises concurrent submissions of the same week; the second caller
  -- waits here and then takes the already-submitted branch below.
  select * into sub from ts_weekly_submissions
   where employee_id = emp.id and week_start = p_week_start
   for update;
  if not found then raise exception 'no_draft' using errcode = '02000'; end if;

  if sub.status <> 'draft' then
    return jsonb_build_object(
      'ok', true, 'alreadySubmitted', true,
      'submissionId', sub.id, 'submittedAt', sub.submitted_at,
      'totalHours', sub.total_hours, 'billableHours', sub.billable_hours,
      'nonBillableHours', sub.non_billable_hours, 'missingHours', sub.missing_hours);
  end if;

  if p_week_start > date_trunc('week', current_date + 1)::date - 1 then
    raise exception 'future_week' using errcode = '22023';
  end if;

  problems := ts_validate_week(sub.id, null);
  if jsonb_array_length(problems) > 0 then
    return jsonb_build_object('ok', false, 'problems', problems);
  end if;

  select coalesce(sum(hours), 0),
         coalesce(sum(hours) filter (where billable), 0)
    into t_total, t_bill
    from ts_entries where submission_id = sub.id;

  update ts_entries
     set status = 'submitted',
         submitted_at = coalesce(submitted_at, now()),
         updated_at = now()
   where submission_id = sub.id;

  update ts_weekly_submissions
     set status             = 'submitted',
         submitted_at       = now(),
         total_hours        = t_total,
         billable_hours     = t_bill,
         non_billable_hours = t_total - t_bill,
         expected_hours     = emp.expected_weekly_hours,
         missing_hours      = greatest(emp.expected_weekly_hours - t_total, 0),
         updated_at         = now()
   where id = sub.id
  returning * into sub;

  insert into ts_audit_log (actor_email, action, record_type, record_id, details)
  values (emp.email, 'week.submitted', 'submission', sub.id::text,
          jsonb_build_object('week_start', p_week_start, 'total_hours', t_total,
                             'billable_hours', t_bill));

  return jsonb_build_object(
    'ok', true, 'alreadySubmitted', false,
    'submissionId', sub.id, 'submittedAt', sub.submitted_at,
    'totalHours', sub.total_hours, 'billableHours', sub.billable_hours,
    'nonBillableHours', sub.non_billable_hours, 'missingHours', sub.missing_hours);
end;
$$;
