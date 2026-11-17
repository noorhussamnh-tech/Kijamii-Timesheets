-- 0064: no ts_* function is reachable without signing in.
--
-- Found by probing rather than by reading: thirty-five SECURITY DEFINER
-- functions could be executed by the `anon` role, which means by anybody
-- holding the publishable key -- and that key ships inside the frontend
-- bundle, so it is public by design.
--
-- Almost all of them hold anyway, and that was checked one at a time as anon
-- rather than assumed: the tables return no rows under RLS, the admin
-- functions raise not_authorized, the trigger functions refuse to run outside
-- a trigger, and the "my..." functions resolve to nobody. One leaked:
--
--   set role anon;
--   select ts_manager_email_for('Ramy Kamel Mohamed Taher Omar');
--    -> ramy.kamel@kijamii.com
--
-- It carries no guard because every intended caller is another SECURITY
-- DEFINER function, where it runs as the definer and never as anon. Given a
-- name it hands back that person's address, so the staff list is enumerable by
-- anybody who can guess names. Addresses follow first.last@kijamii.com, so the
-- disclosure is small -- but it is unauthenticated, and it is one grant.
--
-- Every ts_* function is closed to anon here, not just that one, because the
-- next unguarded helper somebody adds should not be reachable either.
--
-- The mechanism matters. anon did not hold these privileges directly: Postgres
-- grants EXECUTE on a new function to PUBLIC, and anon inherits from there. So
-- `revoke ... from anon` alone changes nothing, which is exactly what happened
-- on the first attempt -- the revoke ran, the privilege check still reported
-- 42 functions reachable, and the migration refused itself. Revoking PUBLIC is
-- what works, and it takes authenticated and service_role down with it unless
-- their access is handed back.
--
-- So this reads each function's current privileges first, revokes PUBLIC and
-- anon, then restores authenticated and service_role exactly where they held
-- it before. Nothing is widened: a function deliberately locked away from
-- authenticated -- ts_apply_directory, revoked in 0018 -- stays locked, which
-- a blanket grant to authenticated would have quietly undone.

create temp table priv_before on commit drop as
select p.oid,
       p.oid::regprocedure::text                                as sig,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as had_auth,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') as had_service,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as had_anon
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'ts\_%';

do $$
declare r record; closed integer := 0;
begin
  for r in select * from priv_before loop
    execute format('revoke execute on function %s from public', r.sig);
    execute format('revoke execute on function %s from anon',   r.sig);
    if r.had_auth then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
    if r.had_service then
      execute format('grant execute on function %s to service_role', r.sig);
    end if;
    if r.had_anon then closed := closed + 1; end if;
  end loop;
  raise notice 'closed anon on % of % ts_ functions', closed, (select count(*) from priv_before);
end $$;

-- Either all three hold, or nothing is committed.
do $$
declare bad integer; v text;
begin
  -- 1. Nothing reachable without a session.
  select count(*) into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'ts\_%'
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  if bad <> 0 then raise exception '% functions are still executable by anon', bad; end if;

  -- 2. Signed-in users kept exactly what they had, no more and no less.
  select count(*) into bad
    from priv_before b
   where b.had_auth <> has_function_privilege('authenticated', b.oid, 'EXECUTE')
      or b.had_service <> has_function_privilege('service_role', b.oid, 'EXECUTE');
  if bad <> 0 then raise exception '% functions changed access for signed-in roles', bad; end if;

  -- 3. The one that actually leaked is shut, proven the way it was found.
  begin
    set local role anon;
    v := ts_manager_email_for('Ramy Kamel Mohamed Taher Omar');
    reset role;
    raise exception 'ts_manager_email_for still answers anon with %', v;
  exception
    when insufficient_privilege then reset role;
  end;

  -- 4. And the app's own calls still resolve for a signed-in caller.
  select count(*) into bad
    from (values ('ts_my_profile'),('ts_get_week'),('ts_save_draft'),('ts_submit_week'),
                 ('ts_submit_day'),('ts_list_my_days'),('ts_my_stats'),('ts_my_logged_days'),
                 ('ts_my_team_scope'),('ts_admin_range_overview'),('ts_team_range_overview'),
                 ('ts_export_range'),('ts_export_team_range'),('ts_export_employee_detail'),
                 ('ts_export_team_detail'),('ts_export_time_dedication'),
                 ('ts_export_team_dedication'),('ts_sync_directory')) as want(nm)
    join pg_proc p on p.proname = want.nm
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
   where not has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if bad <> 0 then
    raise exception '% functions the app calls are no longer callable by a signed-in user', bad;
  end if;
end $$;
