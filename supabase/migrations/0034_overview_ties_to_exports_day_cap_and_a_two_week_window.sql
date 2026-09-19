-- 0034: three corrections to what the numbers mean.
--
-- 1. The overview counted drafts in its hours column; every export excludes
--    them. Anybody checking one against the other found figures that did not
--    tie, which is the fastest way to lose trust in all of them.
-- 2. The 16-hour day cap was only applied when submitting a day. Submitting a
--    week never called the validator, so an 80-hour Tuesday went straight in.
-- 3. A submitted week stayed editable for ever, so a month already pasted
--    into the OPS sheet could change underneath it.

-- ------------------------------------- 1. the overview counts what exports do

do $$
declare src text; out text;
begin
  src := pg_get_functiondef('public.ts_admin_range_overview(date, date)'::regprocedure);

  out := replace(src,
    E'                      coalesce(sum(e.hours), 0)                       as total,\n',
    E'                      coalesce(sum(e.hours), 0)                       as total,\n'
      || E'                      coalesce(sum(e.hours) filter (where e.status <> \'draft\'), 0) as filed,\n'
      || E'                      coalesce(sum(e.hours) filter (where e.status = \'draft\'), 0)  as unfiled,\n');
  if out = src then raise exception 'overview: hours total not found'; end if;
  src := out;

  -- The headline figure is what an export would give you. Draft hours are
  -- still reported, separately, because "logged nothing" and "logged but has
  -- not filed" are different problems for an admin chasing people.
  out := replace(src,
    E'               \'totalHours\', coalesce(live.total, 0),\n',
    E'               \'totalHours\', coalesce(live.filed, 0),\n'
      || E'               \'draftHours\', coalesce(live.unfiled, 0),\n');
  if out = src then raise exception 'overview: totalHours key not found'; end if;

  execute out;
end $$;

-- --------------------------- 2. the day cap applies however a row is filed

-- A deferred constraint trigger rather than a check inside each submit path:
-- it sees the finished state of the transaction, so filing six rows at once
-- is judged on the total they add up to, and no future submit route can slip
-- past it the way submitting a week already did.
create or replace function public.ts_day_within_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  day_total numeric;
begin
  if new.status = 'draft' then
    return null;
  end if;

  select coalesce(sum(e.hours), 0) into day_total
    from ts_entries e
   where e.employee_id = new.employee_id
     and e.work_date = new.work_date
     and e.status <> 'draft';

  if day_total > 16 then
    raise exception 'day_over_limit'
      using errcode = '23514',
            detail = format('%s totals %s filed hours; the most for one day is 16.',
                            to_char(new.work_date, 'FMDD Mon YYYY'), day_total);
  end if;

  return null;
end;
$$;

drop trigger if exists ts_entries_day_within_limit on ts_entries;
create constraint trigger ts_entries_day_within_limit
  after insert or update on ts_entries
  deferrable initially deferred
  for each row execute function public.ts_day_within_limit();

-- ------------------------------------------- 3. a two-week editing window

alter table ts_weekly_submissions add column if not exists edit_until timestamptz;

comment on column ts_weekly_submissions.edit_until is
  'Set when an admin reopens a week, to grant a fresh window on a week the '
  'fourteen-day rule has already closed. Null means the ordinary rule applies.';

-- Open while the week is running and for a fortnight after it ends. That is
-- long enough to fix what you got wrong and short enough that a month handed
-- to the CEO stays the month they were handed.
create or replace function public.ts_week_is_open(p_week_start date, p_edit_until timestamptz)
returns boolean
language sql
stable
as $$
  select current_date <= p_week_start + 6 + 14
      or (p_edit_until is not null and now() <= p_edit_until);
$$;

create or replace function public.ts_week_still_open()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  open_now boolean;
begin
  select ts_week_is_open(s.week_start, s.edit_until) into open_now
    from ts_weekly_submissions s
   where s.id = coalesce(new.submission_id, old.submission_id);

  if coalesce(open_now, true) then
    return new;
  end if;

  raise exception 'week_closed'
    using errcode = '42501',
          detail = 'This week closed a fortnight after it ended. Ask an admin to reopen it.';
end;
$$;

drop trigger if exists ts_entries_week_still_open on ts_entries;
create trigger ts_entries_week_still_open
  before insert or update on ts_entries
  for each row execute function public.ts_week_still_open();

-- Reopening grants a fresh fortnight, or the person still could not edit the
-- week an admin just opened for them.
do $$
declare src text; out text;
begin
  src := pg_get_functiondef('public.ts_admin_reopen_week(uuid, date, text)'::regprocedure);
  out := replace(src,
    E'     set status = \'draft\', submitted_at = null, updated_at = now()\n   where id = sub.id;',
    E'     set status = \'draft\', submitted_at = null, updated_at = now(),\n'
      || E'         edit_until = now() + interval \'14 days\'\n   where id = sub.id;');
  if out = src then raise exception 'reopen: submission update not found'; end if;
  execute out;
end $$;
