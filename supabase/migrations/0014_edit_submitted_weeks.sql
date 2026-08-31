-- Submitting stopped being a lock.
--
-- A submitted week could only be read, which made every remembered correction
-- impossible: the person who realises on Wednesday that Monday's four hours
-- were logged against the wrong brand had no way to say so, and the number
-- stayed wrong forever. Submitting now means "I have reported this", not "this
-- can never be touched again".
--
-- What that costs is honest to state: a report exported on Monday may not
-- match the same query run on Friday, because the underlying week can still
-- change. The audit log below is what makes that traceable rather than
-- mysterious -- every save that alters an already-submitted week is recorded.
--
-- The week's snapshotted totals are recomputed on every save, so they cannot
-- drift away from the rows they are meant to summarise.

-- ------------------------------------------------------------------ policies

-- A row belongs to the person who logged it, whatever its status.
drop policy if exists ts_entries_insert on ts_entries;
create policy ts_entries_insert on ts_entries
  for insert to authenticated
  with check (
    employee_id = ts_current_employee_id()
    and exists (
      select 1 from ts_weekly_submissions s
      where s.id = submission_id
        and s.employee_id = ts_current_employee_id()
    )
  );

drop policy if exists ts_entries_update on ts_entries;
create policy ts_entries_update on ts_entries
  for update to authenticated
  using (employee_id = ts_current_employee_id())
  with check (employee_id = ts_current_employee_id());

drop policy if exists ts_entries_delete on ts_entries;
create policy ts_entries_delete on ts_entries
  for delete to authenticated
  using (employee_id = ts_current_employee_id());

-- --------------------------------------------------------------- save_draft

create or replace function ts_save_draft(p_week_start date, p_entries jsonb, p_revision bigint)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  emp       ts_employees;
  sub       ts_weekly_submissions;
  kept      uuid[];
  item      jsonb;
  v_market  ts_market;
  v_client  uuid;
  was_sent  boolean;
  touched   integer := 0;
begin
  select * into emp from ts_employees
   where auth_user_id = auth.uid() and active and onboarded_at is not null;
  if not found then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if extract(dow from p_week_start) <> 0 then
    raise exception 'week_must_start_sunday' using errcode = '22023';
  end if;

  insert into ts_weekly_submissions (employee_id, week_start, expected_hours)
  values (emp.id, p_week_start, emp.expected_weekly_hours)
  on conflict (employee_id, week_start) do nothing;

  select * into sub from ts_weekly_submissions
   where employee_id = emp.id and week_start = p_week_start
   for update;

  -- A submitted week is no longer refused. It is remembered, so the change
  -- can be recorded as the amendment to reported figures that it is.
  was_sent := sub.status <> 'draft';

  if p_revision is not null and p_revision <= sub.draft_revision then
    return jsonb_build_object('stale', true, 'revision', sub.draft_revision);
  end if;

  kept := array(select (e ->> 'id')::uuid
                  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e
                 where e ->> 'id' is not null);

  -- Rows the person removed go, whether or not they had been submitted.
  -- The browser always sends the whole week, so absence here is a deletion
  -- rather than a gap.
  delete from ts_entries en
   where en.submission_id = sub.id
     and not (en.id = any (kept));
  get diagnostics touched = row_count;

  for item in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb))
  loop
    v_client := nullif(item ->> 'client_id', '')::uuid;

    -- The market stamped on the row is derived from the client, never taken
    -- from the browser.
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
      -- status is deliberately not touched: editing a submitted row corrects
      -- it, it does not withdraw it back into a draft.
    where ts_entries.employee_id = emp.id;
  end loop;

  -- The stored totals summarise the rows, so they are rebuilt from the rows
  -- rather than left as whatever was true at submission time.
  update ts_weekly_submissions s
     set total_hours        = t.total,
         billable_hours     = t.billable,
         non_billable_hours = t.non_billable,
         missing_hours      = greatest(s.expected_hours - t.total, 0),
         draft_revision     = coalesce(p_revision, s.draft_revision + 1),
         updated_at         = now()
    from (
      select coalesce(sum(hours), 0)                                  as total,
             coalesce(sum(hours) filter (where billable), 0)          as billable,
             coalesce(sum(hours) filter (where not billable), 0)      as non_billable
        from ts_entries
       where submission_id = sub.id and hours is not null
    ) t
   where s.id = sub.id
  returning s.* into sub;

  if was_sent then
    insert into ts_audit_log (actor_email, action, record_type, record_id, details)
    values (emp.email, 'week.amended_after_submission', 'submission', sub.id::text,
            jsonb_build_object('week_start', p_week_start,
                               'rows_removed', touched,
                               'total_hours', sub.total_hours));
  end if;

  return jsonb_build_object(
    'stale', false,
    'submission_id', sub.id,
    'revision', sub.draft_revision,
    'saved_at', sub.updated_at
  );
end;
$$;

comment on function ts_save_draft(date, jsonb, bigint) is
  'Saves a week, submitted or not. Editing a submitted row corrects it without withdrawing it; amendments to a submitted week are recorded in ts_audit_log.';
