-- 0060: a catch-up window, so everyone can still fill October in.
--
-- 0034 closed a week a fortnight after it ended, to stop a month already
-- handed to the CEO changing underneath it. That rule is right for steady
-- state and wrong for a pilot whose whole point is getting October captured:
-- the weeks of 27 Sep, 4 Oct and 11 Oct are all shut, and nobody can reach
-- them. Reopening week by week would not do it either, because somebody who
-- never touched one of those weeks has no submission row to reopen -- the row
-- is created at save time, already carrying a closed week_start.
--
-- So the exception is a policy, in one row, with an end date on it. When
-- open_until passes, the fortnight rule simply resumes; nothing has to be
-- undone.

create table if not exists public.ts_backfill_window (
  only_row   boolean primary key default true check (only_row),
  open_from  date not null,
  open_until timestamptz not null,
  note       text,
  updated_at timestamptz not null default now()
);

comment on table public.ts_backfill_window is
  'At most one row. While now() <= open_until, any day on or after open_from can '
  'be logged or edited whatever the fourteen-day rule says. Let open_until pass, '
  'or delete the row, and the ordinary rule applies again with nothing to revert.';

alter table public.ts_backfill_window enable row level security;

-- Readable by anyone signed in, so the app can explain why an old day accepts
-- an edit. Deliberately no write policy: the window is set by an admin running
-- SQL, never from a browser, so a compromised client cannot extend it.
drop policy if exists ts_backfill_window_read on public.ts_backfill_window;
create policy ts_backfill_window_read on public.ts_backfill_window
  for select using (auth.uid() is not null);

insert into public.ts_backfill_window (open_from, open_until, note)
values (date '2026-10-01',
        timestamptz '2026-11-30 23:59:59+02',
        'October catch-up for the pilot: everyone fills in from 1 October.')
on conflict (only_row) do update
   set open_from  = excluded.open_from,
       open_until = excluded.open_until,
       note       = excluded.note,
       updated_at = now();

-- The floor is the entry's own work_date, not its week's start. That is what
-- lets the week of 27 September accept 1-3 October without also reopening
-- 27-30 September, which nobody asked for.
create or replace function public.ts_week_still_open()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  open_now boolean;
  w_from   date;
begin
  select open_from into w_from
    from public.ts_backfill_window
   where now() <= open_until;

  if w_from is not null and new.work_date >= w_from then
    return new;
  end if;

  select ts_week_is_open(s.week_start, s.edit_until) into open_now
    from ts_weekly_submissions s
   where s.id = coalesce(new.submission_id, old.submission_id);

  if coalesce(open_now, true) then
    return new;
  end if;

  -- Two different refusals. Saying "ask an admin to reopen it" while a
  -- catch-up window is running would send somebody to ask for something they
  -- already have.
  if w_from is not null then
    raise exception 'week_closed'
      using errcode = '42501',
            detail = format(
              'The catch-up window covers %s onward. Days before that stay closed.',
              to_char(w_from, 'FMDD Mon YYYY'));
  end if;

  raise exception 'week_closed'
    using errcode = '42501',
          detail = 'This week closed a fortnight after it ended. Ask an admin to reopen it.';
end;
$$;
