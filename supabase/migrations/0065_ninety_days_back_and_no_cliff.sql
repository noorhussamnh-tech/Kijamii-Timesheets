-- 0065: the catch-up window becomes a rolling 90 days, with no expiry date.
--
-- 0060 opened a fixed window: everything from 1 October, until 30 November.
-- That shape has a cliff in it. On 1 December the window would have shut and
-- the fortnight lock resumed, and every week from 27 September to 8 November
-- would have locked in the same instant -- 1,507 hours of shortfall that
-- nobody could fix afterwards without an admin reopening each person-week by
-- hand. The date was also arbitrary: it answered "how long do we give them"
-- with a guess made six weeks ago.
--
-- A rolling window has no cliff. Any day inside the last 90 can be fixed, the
-- boundary moves with the calendar, and nothing expires while people are still
-- learning the tool. `open_until` stays on the table so the window can be
-- ended deliberately one day, and is null now, which means no expiry: ending
-- the catch-up should be a decision somebody takes, not a date that arrives
-- while nobody is looking.
--
-- open_from is retired rather than kept as a floor. A floor of 1 October would
-- quietly make "90 days" mean "since the pilot started", which is not what was
-- asked for and would start lying the moment 90 days reached past it.

alter table ts_backfill_window
  add column if not exists open_days integer;

-- "No expiry" has to be expressible before it can be set. 0060 made this
-- column mandatory because a window then always had an end date.
alter table ts_backfill_window
  alter column open_until drop not null;

update ts_backfill_window
   set open_days  = 90,
       open_until = null,
       note       = 'Rolling 90 days while people learn the tool. '
                 || 'Set open_until to end it deliberately; null means no expiry.',
       updated_at = now();

alter table ts_backfill_window
  alter column open_days set not null,
  alter column open_days set default 90;

alter table ts_backfill_window
  add constraint ts_backfill_window_days_sane
  check (open_days between 0 and 400);

alter table ts_backfill_window drop column if exists open_from;

comment on column ts_backfill_window.open_days is
  'How many days back may still be edited, counted from today. Rolling, so it '
  'never arrives at a cliff.';
comment on column ts_backfill_window.open_until is
  'When the catch-up ends. Null means no expiry -- the usual state while the '
  'rollout is young.';

create or replace function public.ts_week_still_open()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  open_now boolean;
  w_from   date;
  w_days   integer;
begin
  -- The rolling floor, or null when the catch-up has been ended deliberately.
  select case when b.open_until is null or now() <= b.open_until
              then current_date - b.open_days end,
         b.open_days
    into w_from, w_days
    from public.ts_backfill_window b;

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
              'The catch-up window covers the last %s days, so %s onward. Days before that stay closed.',
              w_days, to_char(w_from, 'FMDD Mon YYYY'));
  end if;

  raise exception 'week_closed'
    using errcode = '42501',
          detail = 'This week closed a fortnight after it ended. Ask an admin to reopen it.';
end;
$function$;

-- What the window actually covers today, and that the cliff is gone.
do $$
declare w record; floor_date date;
begin
  select * into w from ts_backfill_window;
  if w.open_days <> 90 then raise exception 'window is % days, not 90', w.open_days; end if;
  if w.open_until is not null then raise exception 'window still has an expiry'; end if;

  floor_date := current_date - w.open_days;

  -- Every week the old fixed window would have locked on 1 December must be
  -- editable now, or this change has not done its job.
  if floor_date > date '2026-09-27' then
    raise exception 'rolling floor is %, which still locks the 27 Sep week', floor_date;
  end if;

  raise notice 'catch-up now covers % onward, and moves with the calendar', floor_date;
end $$;
