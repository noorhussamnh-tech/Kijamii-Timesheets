-- 0021: the table itself refuses an incomplete submission.
--
-- Date, Client, Project Type, Work Type and Hours must all be answered before
-- a row can be filed, and the guarantee belongs in the database rather than in
-- the browser or in the submit function -- so no code path, no direct SQL edit
-- and no function written later can produce a filed row missing one.
--
-- There was already a constraint here and it had two faults. It did not know
-- about project_type or work_type, so a row missing either could be filed. And
-- it required service_id, which stopped being something a person answers: it
-- is derived from their department, and the departments that do not sell a
-- service -- Finance, IT, People & Culture, Commercial, Management -- have
-- none. Seventeen people would have met a raw constraint violation on their
-- first submission, with no way to satisfy it, because the field they were
-- missing was not one they could fill.

-- Taking the columns rather than the row, so a CHECK constraint can call it:
-- whole-row references are not allowed in one. That keeps a single definition
-- of "finished" behind both the constraint and the submit.
create or replace function public.ts_entry_ready(
  p_hours        numeric,
  p_client_id    uuid,
  p_client_other text,
  p_project_type text,
  p_work_type    ts_work_type
)
returns boolean
language sql
immutable
as $$
  select p_hours is not null
     and (p_client_id is not null
          or nullif(btrim(coalesce(p_client_other, '')), '') is not null)
     and nullif(btrim(coalesce(p_project_type, '')), '') is not null
     and p_work_type is not null;
$$;

-- Point the submit at the new signature, rewriting it from its own catalogue
-- definition so this cannot disagree with whatever else that body is doing.
do $outer$
declare
  src  text;
  hits integer;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ts_submit_week';
  hits := (length(src) - length(replace(src, 'ts_entry_ready(e)', ''))) / length('ts_entry_ready(e)');
  if hits <> 4 then
    raise exception 'ts_submit_week: expected four readiness calls, found %', hits;
  end if;
  execute replace(src, 'ts_entry_ready(e)',
    'ts_entry_ready(e.hours, e.client_id, e.client_other, e.project_type, e.work_type)');
end;
$outer$;

drop function if exists public.ts_entry_ready(ts_entries);

-- Rows filed before Work Type existed. They were complete under the rules that
-- applied when they were sent and are not wrong, but they do not answer the
-- question the column now asks, so they go back to being drafts for their
-- owners to classify. Nothing is guessed on their behalf.
update ts_entries
   set status = 'draft', submitted_at = null, updated_at = now()
 where status <> 'draft'
   and not ts_entry_ready(hours, client_id, client_other, project_type, work_type);

alter table ts_entries drop constraint if exists ts_entries_submitted_is_complete;

alter table ts_entries add constraint ts_entries_submitted_is_complete
  check (status = 'draft'
         or (work_date is not null
             and ts_entry_ready(hours, client_id, client_other, project_type, work_type)));

-- A filed row edited until it is no longer complete stops being a filed row.
-- Without this the constraint would reject the save outright, and somebody
-- would lose an edit to a raw database error for the crime of clearing a field
-- they meant to retype.
do $outer$
declare
  src    text;
  needle text;
  hits   integer;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ts_save_draft';
  needle := '      work_type    = excluded.work_type,';
  hits := (length(src) - length(replace(src, needle, ''))) / length(needle);
  if hits <> 1 then
    raise exception 'ts_save_draft: expected one work_type assignment, found %', hits;
  end if;
  execute replace(src, needle, needle || '
      status       = case when ts_entry_ready(excluded.hours, excluded.client_id,
                                              excluded.client_other, excluded.project_type,
                                              excluded.work_type)
                          then ts_entries.status else ''draft''::ts_status end,
      submitted_at = case when ts_entry_ready(excluded.hours, excluded.client_id,
                                              excluded.client_other, excluded.project_type,
                                              excluded.work_type)
                          then ts_entries.submitted_at else null end,');
end;
$outer$;

-- Demoting the rows leaves their weeks behind. A week reading "submitted" with
-- nothing filed under it is worse than one reading "draft": it tells the person
-- chasing timesheets that the work is in, and tells the person who logged it
-- that there is nothing to do.
update ts_weekly_submissions s
   set status = 'draft', submitted_at = null, updated_at = now()
 where s.status <> 'draft'
   and not exists (select 1 from ts_entries e
                    where e.submission_id = s.id and e.status <> 'draft');

-- Same for the per-day badges: a day is only closed off while nothing on it is
-- still a draft.
delete from ts_day_locks l
 where exists (select 1 from ts_entries e
                where e.submission_id = l.submission_id
                  and e.work_date = l.work_date
                  and e.status = 'draft');
