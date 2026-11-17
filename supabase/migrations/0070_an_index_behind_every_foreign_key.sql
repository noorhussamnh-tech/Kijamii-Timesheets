-- 0070: the six foreign keys that had no index behind them.
--
-- Postgres does not index a foreign key for you. Without one, two things scan
-- the whole table: a join from the child side, and the referential check that
-- runs whenever a parent row is deleted or its key changes. At 1,594 entries
-- neither is measurable, which is why this is worth doing now -- the cost of
-- adding them is nil today and the cost of noticing them later is a report
-- that has quietly become slow. ts_entries is the one that will grow.
--
-- `if not exists` so this is safe to run twice, and no `concurrently` because
-- these tables are small enough that the lock is shorter than the round trip
-- that asked for it.
--
-- One of the six does not land here. See 0071: an index of the name this file
-- uses already existed on a single column, so `if not exists` matched the name
-- and skipped, and the check below -- which asserts names rather than columns
-- -- was too weak to notice.

create index if not exists ts_entries_client_id_idx
  on ts_entries (client_id);

create index if not exists ts_entries_service_id_idx
  on ts_entries (service_id);

create index if not exists ts_entries_submission_idx
  on ts_entries (submission_id, week_start);

create index if not exists ts_employee_teams_team_id_idx
  on ts_employee_teams (team_id);

create index if not exists ts_client_teams_team_id_idx
  on ts_client_teams (team_id);

create index if not exists ts_departments_service_id_idx
  on ts_departments (service_id);

do $$
declare missing text;
begin
  select string_agg(want.name, ', ') into missing
    from (values ('ts_entries_client_id_idx'), ('ts_entries_service_id_idx'),
                 ('ts_entries_submission_idx'), ('ts_employee_teams_team_id_idx'),
                 ('ts_client_teams_team_id_idx'), ('ts_departments_service_id_idx')) as want(name)
   where not exists (
     select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'i' and c.relname = want.name);
  if missing is not null then
    raise exception 'indexes were not created: %', missing;
  end if;
end $$;
