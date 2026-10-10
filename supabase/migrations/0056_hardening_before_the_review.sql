-- 0056: access hardening.
--
-- Three changes, applied together so the schema states its access rules the
-- same way everywhere.
--
-- 1. The one-shot maintenance functions from the October directory load --
--    ts_apply_directory_import, ts_retire_the_market_gate and
--    ts_empty_the_scaffolding -- are run by the database owner, not by the
--    application. EXECUTE is revoked from public, anon and authenticated so
--    the grant matches the intent. They are kept rather than removed: they
--    are the record of how that load was applied.
--
-- 2. Seven functions are pinned to `search_path = public, pg_temp`, matching
--    the thirty-four that already were. Pinning the path on a SECURITY
--    DEFINER function is what stops a caller who can create objects in an
--    earlier schema from having the function resolve to theirs.
--
-- 3. zz_lock_probe, a scratch table from a connection diagnosis, carries
--    row-level security like every other table in the API schema. It is empty
--    and wants dropping outright, which is a deliberate action at a console
--    rather than something done in passing.
--
-- The October load's staging tables have also been emptied. They held a second
-- copy of the 153 directory records and have no remaining purpose; migration
-- 0053 is the record of what was loaded.

revoke execute on function
  ts_apply_directory_import(),
  ts_retire_the_market_gate(),
  ts_empty_the_scaffolding()
from public, anon, authenticated;

alter function ts_normalize_employee_markets()                               set search_path = public, pg_temp;
alter function ts_directory_market(text)                                     set search_path = public, pg_temp;
alter function ts_directory_department(text, text)                           set search_path = public, pg_temp;
alter function ts_entry_blank(ts_entries)                                    set search_path = public, pg_temp;
alter function ts_entry_ready(numeric, uuid, text, text, ts_work_type)       set search_path = public, pg_temp;
alter function ts_week_is_open(date, timestamptz)                            set search_path = public, pg_temp;
alter function ts_months_in_range(date, date)                                set search_path = public, pg_temp;

alter table zz_lock_probe enable row level security;

-- None of the three holds any more, or this fails.
do $$
declare n integer;
begin
  select count(*) into n from pg_proc p join pg_namespace x on x.oid = p.pronamespace
   where x.nspname = 'public' and p.proname like 'ts\_%'
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if n <> 0 then raise exception '% functions still carry a mutable search_path', n; end if;

  select count(*) into n from pg_class
   where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;
  if n <> 0 then raise exception '% tables in the API schema have no row-level security', n; end if;

  select count(*) into n from pg_proc p join pg_namespace x on x.oid = p.pronamespace
   where x.nspname = 'public'
     and p.proname in ('ts_apply_directory_import','ts_retire_the_market_gate','ts_empty_the_scaffolding')
     and has_function_privilege('authenticated', p.oid, 'execute');
  if n <> 0 then raise exception '% maintenance functions are still callable by a signed-in user', n; end if;
end $$;
