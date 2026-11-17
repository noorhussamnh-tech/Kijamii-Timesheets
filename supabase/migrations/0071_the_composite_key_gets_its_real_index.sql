-- 0071: the one index 0070 only appeared to create.
--
-- 0070 ran `create index if not exists ts_entries_submission_idx on ts_entries
-- (submission_id, week_start)`. An index of that name already existed, on
-- submission_id alone, so `if not exists` matched the name and skipped --
-- leaving the two-column foreign key still uncovered while the migration
-- reported success.
--
-- It reported success because I had just weakened the check. The first version
-- compared each key's columns against the indexes on its table and named
-- ts_entries_submission_fkey as still bare, which was correct. I read two
-- failures as the check being wrong, replaced it with one asserting the six
-- index *names* exist, and that passed on a name whose definition was not what
-- the migration asked for. The linter caught what the weakened check could not.
--
-- So the real index is created under a name of its own, and the column-level
-- check is restored with the detail that confused me written down: indkey is an
-- int2vector subscripted from zero, conkey a smallint[] subscripted from one.
--
-- The old single-column index is left alone. A composite leading on
-- submission_id serves every lookup the narrower one did, so it could go, but
-- dropping a live index to save a few kilobytes on a 1,594-row table is risk
-- with nothing on the other side of it.

create index if not exists ts_entries_submission_week_idx
  on ts_entries (submission_id, week_start);

do $$
declare bare text;
begin
  select string_agg(t.relname || '.' || c.conname, ', ') into bare
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
   where c.contype = 'f'
     and c.connamespace = 'public'::regnamespace
     and t.relname like 'ts\_%'
     and not exists (
       select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (select array_agg(i.indkey[s] order by s)
                 from generate_series(0, array_length(c.conkey, 1) - 1) s) = c.conkey
     );
  if bare is not null then
    raise exception 'foreign keys with no index behind them: %', bare;
  end if;
end $$;
