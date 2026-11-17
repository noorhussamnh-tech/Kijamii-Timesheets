-- 0067: new functions stop being reachable without a session by default,
-- and the two capacity numbers are written down where they are used.
--
-- ------------------------------------------------------- the door I left open
--
-- 0064 closed 35 functions to anon and said in as many words that the next
-- helper somebody added should not be reachable either. Two hours later 0066
-- added ts_assumed_hours and it was reachable, because Postgres grants EXECUTE
-- on every new function to PUBLIC and anon inherits from there. The function
-- itself gives nothing away -- it is date arithmetic over its own arguments
-- and reads no table -- but the count went from nought back to one, which is
-- the number that matters. I wrote the warning and then walked into it.
--
-- Remembering to revoke is not a fix, it is the thing that just failed. So the
-- revoke happens on its own from here: an event trigger fires after any
-- CREATE FUNCTION in public whose name starts ts_, and takes PUBLIC and anon
-- off it. It only ever removes, never grants, so it cannot widen anything by
-- accident, and a function that genuinely needs anon can say so afterwards.
--
-- ts_no_anon_functions() is the assertion on its own, for any later migration
-- that wants to check rather than assume.
--
-- ------------------------------------------------- 140 hours against 160
--
-- 0066 left these disagreeing and called it a business decision. It is not a
-- disagreement, and the answer is recorded here so nobody reconciles them into
-- one number later:
--
--   140 is monthly capacity -- what the business plans and bills against.
--   160 is what a person is asked to fill in: 8 hours a day, 5 days a week.
--
-- They measure different things, so both are right and the gap between them is
-- real rather than an error. Capacity planning uses 140; the ceiling on what
-- the tool may assume somebody owes is 160.

revoke execute on function public.ts_assumed_hours(date, date, numeric) from public, anon;
grant  execute on function public.ts_assumed_hours(date, date, numeric) to authenticated;

create or replace function public.ts_no_anon_functions()
returns integer
language sql
stable
set search_path to 'public', 'pg_temp'
as $fn$
  select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname like 'ts\_%'
     and has_function_privilege('anon', p.oid, 'EXECUTE');
$fn$;

comment on function public.ts_no_anon_functions() is
  'How many ts_ functions an unauthenticated caller could execute. Must be 0.';

create or replace function public.ts_close_new_functions()
returns event_trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare r record;
begin
  for r in
    select objid, object_identity
      from pg_event_trigger_ddl_commands()
     where command_tag in ('CREATE FUNCTION', 'ALTER FUNCTION')
  loop
    -- Only ours, and only ever taking access away.
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.oid = r.objid and n.nspname = 'public' and p.proname like 'ts\_%')
    then
      execute format('revoke execute on function %s from public, anon', r.object_identity);
    end if;
  end loop;
end;
$fn$;

drop event trigger if exists ts_close_new_functions_trg;
create event trigger ts_close_new_functions_trg
  on ddl_command_end
  when tag in ('CREATE FUNCTION', 'ALTER FUNCTION')
  execute function public.ts_close_new_functions();

comment on function public.ts_close_new_functions() is
  'Takes PUBLIC and anon off every new or altered public.ts_ function. Removes '
  'access only; a function that needs anon must be granted it deliberately.';

-- The two helpers above were created before the trigger existed, so they took
-- the default grant to PUBLIC on the way in -- the same mistake this migration
-- exists to stop, committed twice more while fixing it. Closed by hand here;
-- everything created after this point is closed by the trigger.
revoke execute on function public.ts_no_anon_functions()   from public, anon;
revoke execute on function public.ts_close_new_functions() from public, anon;
grant  execute on function public.ts_no_anon_functions()   to authenticated;

-- The two numbers, written where somebody will read them.
comment on function public.ts_export_team_dedication(date, date) is
  'Assumed against actual team time. Capacity here is 140 hours a month, which '
  'is what the business plans and bills against -- deliberately not the 160 '
  'that ts_assumed_hours caps at, because that one is what a person is asked to '
  'fill in (8 hours a day, 5 days a week). Different measures; do not reconcile '
  'them into one number. A person is never assumed to be more than 100%%: rows '
  'totalling over that are scaled back on read.';

-- ---------------------------------------------------------------- the checks
do $$
declare bad integer; probe text;
begin
  bad := ts_no_anon_functions();
  if bad <> 0 then raise exception '% ts_ functions are reachable by anon', bad; end if;

  -- The trigger has to actually fire, so it is tested rather than trusted.
  execute 'create or replace function public.ts_zz_door_probe() returns integer '
       || 'language sql immutable as $p$ select 1 $p$';
  if has_function_privilege('anon', 'public.ts_zz_door_probe()', 'EXECUTE') then
    raise exception 'a newly created ts_ function was still reachable by anon';
  end if;
  execute 'drop function public.ts_zz_door_probe()';

  -- And the signed-in app is untouched.
  if not has_function_privilege('authenticated', 'public.ts_assumed_hours(date,date,numeric)', 'EXECUTE') then
    raise exception 'ts_assumed_hours is no longer callable by a signed-in user';
  end if;
  probe := ts_assumed_hours(date '2026-10-01', date '2026-10-31', 40)::text;
  if probe <> '160.00' then raise exception 'ts_assumed_hours now answers %', probe; end if;
end $$;
