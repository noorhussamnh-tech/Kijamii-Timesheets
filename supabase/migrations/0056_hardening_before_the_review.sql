-- 0056: hardening, ahead of a security review.
--
-- Three real findings, one of them serious and mine.
--
-- 1. Three one-shot maintenance functions written during the October work --
--    ts_apply_directory_import, ts_retire_the_market_gate and
--    ts_empty_the_scaffolding -- were SECURITY DEFINER, carried no
--    authorisation check of their own, and were callable by any signed-in
--    account over the REST API. One of them deletes rows and one alters a
--    table. Every other function in this schema that does anything privileged
--    asks ts_is_admin() first; these did not, because they were written to be
--    called once by hand and nobody thought about the door they left open.
--    EXECUTE is revoked from public, anon and authenticated. They remain for
--    the record and can be run by the database owner.
--
-- 2. Seven functions had a mutable search_path. On a SECURITY DEFINER
--    function that is a privilege-escalation route: a caller who can create
--    objects in a schema earlier on the path can have the function call theirs
--    instead. All seven are now pinned to public, pg_temp, which the other
--    thirty-four already were.
--
-- 3. zz_lock_probe, a table created while diagnosing a connection problem and
--    never removed, sat in the API schema with row-level security off. It is
--    empty and now carries RLS like everything else. It wants dropping, which
--    is a person's call at a console.
--
-- Also: the October load's staging tables have been emptied. They held a
-- second copy of all 153 directory records with no remaining purpose. The
-- record of what was loaded is migration 0053, which is where a record
-- belongs.

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
