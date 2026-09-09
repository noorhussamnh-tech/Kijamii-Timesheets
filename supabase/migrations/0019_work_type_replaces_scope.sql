-- 0019: Scope leaves the timesheet and Work Type takes its place.
--
-- Two questions had been folded into one. "Amend" sat in the Project Type list
-- beside "Campaign" and "Reels", which made a revision of a campaign and a
-- campaign itself two answers to the same question -- and forced a choice
-- between them, so an amended campaign could be filed as one or the other but
-- never as what it was. Whether a row is new work or a revision is now asked
-- separately, and Project Type is left to describe the work.
--
-- Scope -- in or out of what the client contracted for -- was asked for a few
-- days in September and withdrawn. Its column stays, holding what was logged
-- under it; nothing here reads or writes it any more.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ts_work_type') then
    create type ts_work_type as enum ('new_task', 'amend');
  end if;
end;
$$;

alter table ts_entries add column if not exists work_type ts_work_type;

comment on column ts_entries.work_type is
  'Whether the row is new work or a revision. Replaces the Amend project type.';

comment on column ts_entries.scope is
  'Retired. In/out of scope was asked for a few days in September 2026 and is no longer collected; the column keeps what was logged under it.';

-- "Amend" is not a kind of project, and both pitch types are. Deactivated
-- rather than deleted: rows already filed under it keep their label.
update ts_project_types set active = false where lower(name) = 'amend' and active;

insert into ts_project_types (name, sort_order)
select v.name, v.sort_order
  from (values ('Pitch (Retainer)', 72), ('Pitch (Campaign)', 74)) as v(name, sort_order)
 where not exists (select 1 from ts_project_types p where lower(p.name) = lower(v.name));

create or replace function public.ts_save_draft(p_week_start date, p_entries jsonb, p_revision bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  emp       ts_employees;
  sub       ts_weekly_submissions;
  kept      uuid[];
  item      jsonb;
  v_market  ts_market;
  v_client  uuid;
  v_service uuid;
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

  -- The service follows from who is logging, not from what the browser sends.
  -- Resolved once per save: it is the same for every row in the week.
  select d.service_id into v_service
    from ts_departments d
   where lower(d.name) = lower(coalesce(emp.department, ''))
   limit 1;

  insert into ts_weekly_submissions (employee_id, week_start, expected_hours)
  values (emp.id, p_week_start, emp.expected_weekly_hours)
  on conflict (employee_id, week_start) do nothing;

  select * into sub from ts_weekly_submissions
   where employee_id = emp.id and week_start = p_week_start
   for update;

  was_sent := sub.status <> 'draft';

  if p_revision is not null and p_revision <= sub.draft_revision then
    return jsonb_build_object('stale', true, 'revision', sub.draft_revision);
  end if;

  kept := array(select (e ->> 'id')::uuid
                  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e
                 where e ->> 'id' is not null);

  delete from ts_entries en
   where en.submission_id = sub.id
     and not (en.id = any (kept));
  get diagnostics touched = row_count;

  for item in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb))
  loop
    v_client := nullif(item ->> 'client_id', '')::uuid;

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

    -- `task` and `scope` are absent on purpose. Both were asked for and then
    -- withdrawn, and the browser no longer sends either. Writing them here
    -- would overwrite what people did log under them with nulls, the first
    -- time an old row was touched again.
    insert into ts_entries (
      id, submission_id, week_start, employee_id, work_date,
      client_id, client_other, service_id, project_type, project_note,
      hours, billable, work_type, market, department, status
    ) values (
      coalesce(nullif(item ->> 'id', '')::uuid, gen_random_uuid()),
      sub.id, p_week_start, emp.id,
      (item ->> 'work_date')::date,
      v_client,
      nullif(btrim(coalesce(item ->> 'client_other', '')), ''),
      v_service,
      nullif(btrim(coalesce(item ->> 'project_type', '')), ''),
      nullif(btrim(coalesce(item ->> 'project_note', '')), ''),
      nullif(item ->> 'hours', '')::numeric,
      coalesce((item ->> 'billable')::boolean, true),
      -- Left null when unanswered. A draft may hold an unclassified row; the
      -- submit checks are what insist on a choice.
      nullif(item ->> 'work_type', '')::ts_work_type,
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
      project_note = excluded.project_note,
      hours        = excluded.hours,
      billable     = excluded.billable,
      work_type    = excluded.work_type,
      market       = excluded.market,
      updated_at   = now()
    where ts_entries.employee_id = emp.id;
  end loop;

  update ts_weekly_submissions s
     set total_hours        = t.total,
         billable_hours     = t.billable,
         non_billable_hours = t.non_billable,
         missing_hours      = greatest(s.expected_hours - t.total, 0),
         draft_revision     = coalesce(p_revision, s.draft_revision + 1),
         updated_at         = now()
    from (
      select coalesce(sum(hours), 0)                             as total,
             coalesce(sum(hours) filter (where billable), 0)     as billable,
             coalesce(sum(hours) filter (where not billable), 0) as non_billable
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
$function$;

-- The submit checks ask for a Work Type where they used to ask for a Scope.
create or replace function public.ts_validate_week(p_submission uuid, p_scope date default null::date)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
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

  for bad in
    select e.id, e.work_date,
           array_remove(array[
             case when e.hours is null then 'hours' end,
             case when e.client_id is null
                   and nullif(btrim(coalesce(e.client_other, '')), '') is null
                  then 'client' end,
             case when nullif(btrim(coalesce(e.project_type, '')), '') is null then 'projectType' end,
             case when e.work_type is null then 'workType' end
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

  for bad in
    select e.work_date, sum(e.hours) as total
      from ts_entries e
     where e.submission_id = p_submission
       and (p_scope is null or e.work_date = p_scope)
     group by e.work_date having sum(e.hours) > 16
  loop
    problems := problems || jsonb_build_object(
      'code', 'day_over_limit', 'date', bad.work_date,
      'message', format('%s totals %s hours. The most that can be logged in a day is 16.',
                        to_char(bad.work_date, 'FMDay DD Mon'), bad.total));
  end loop;

  return problems;
end;
$function$;

-- The two functions that hand entries back -- one to the timesheet, one to the
-- exports -- now carry work_type alongside the retired scope.
--
-- Rewritten from their own catalogue definition rather than restated in full,
-- so this migration cannot quietly disagree with whatever else those bodies
-- were doing. It asserts on the text it expects to find and fails loudly if a
-- future edit moves it.
do $outer$
declare
  src    text;
  needle text;
  hits   integer;
begin
  -- The timesheet's own read. Without this the field would save and then
  -- vanish on reload, which is worse than not having it.
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ts_get_week';
  needle := $q$'billable', e.billable, 'scope', e.scope,$q$;
  hits := (length(src) - length(replace(src, needle, ''))) / length(needle);
  if hits <> 1 then
    raise exception 'ts_get_week: expected one match for the entry projection, found %', hits;
  end if;
  execute replace(src, needle,
    $q$'billable', e.billable, 'scope', e.scope, 'workType', e.work_type,$q$);

  -- The range export, which feeds the CSV download and the Sheets push.
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ts_export_range';
  needle := $q$'scope',          e.scope,$q$;
  hits := (length(src) - length(replace(src, needle, ''))) / length(needle);
  if hits <> 1 then
    raise exception 'ts_export_range: expected one match for the scope key, found %', hits;
  end if;
  execute replace(src, needle,
    $q$'scope',          e.scope,
             'workType',       e.work_type,$q$);
end;
$outer$;
