-- 0040: Sanofi.
--
-- KFH was asked for at the same time and is already CLI-026, so it is not
-- added again -- the unique index on lower(name) would have refused it, and
-- a second row would have split its hours in every report.
--
-- Healthcare, to sit with Opella, which is Sanofi's consumer health arm and
-- is already on the list as a separate account.

with next_code as (
  select coalesce(max((regexp_replace(client_code, '\D', '', 'g'))::int), 0) as n
    from ts_clients
   where client_code ~ '^CLI-\d+$'
)
insert into ts_clients (client_code, name, sector, markets, is_other, active)
select 'CLI-' || lpad((n.n + 1)::text, 3, '0'), 'Sanofi', 'Healthcare', '{}'::ts_market[], false, true
  from next_code n
 where not exists (select 1 from ts_clients c where lower(c.name) = 'sanofi');
