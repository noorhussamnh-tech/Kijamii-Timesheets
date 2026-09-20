-- 0038: the accounts named in the OPS list's Accounts Mapping tab, plus the
-- two Consumer Insights works on that nobody else does.
--
-- Sixteen of the mapped accounts did not exist as clients, so no entry could
-- ever have been logged against them and no client could have been mapped to
-- a team. Codes continue the existing CLI-nnn sequence.
--
-- Markets are left empty, which the draft writer reads as "available to
-- anybody" -- these are new and nobody has said which entity each belongs to.
-- Sectors are set only where they are not a guess; the rest are null and can
-- be filled from the client list rather than invented here.
--
-- Two names in the sheet are variants of clients that already exist and are
-- deliberately NOT added again: "Shoe Mart" is ShoeMart, "Popeyes" is
-- Popeye's. The app's spelling wins; the mapping should use it.

with next_code as (
  select coalesce(max((regexp_replace(client_code, '\D', '', 'g'))::int), 0) as n
    from ts_clients
   where client_code ~ '^CLI-\d+$'
),
incoming (name, sector) as (values
  ('Netflix',           'Media & Entertainment'),
  ('Spotify',           'Media & Entertainment'),
  ('Seera',             null),
  ('Costa',             'QSR & F&B'),
  ('Yasmina',           null),
  ('Hana',              null),
  ('AlHoboob',          null),
  ('EBC',               null),
  ('City Edge',         'Real Estate'),
  ('Al-Ahli',           'Sports'),
  ('Bayern Munich',     'Sports'),
  ('Bundes Liga',       'Sports'),
  ('Bundes Liga-FR',    'Sports'),
  ('NewCastle',         'Sports'),
  ('AS Roma',           'Sports'),
  ('Atletico Bilbao',   'Sports')
),
fresh as (
  select i.name, i.sector,
         row_number() over (order by i.name) as seq
    from incoming i
   where not exists (
     select 1 from ts_clients c where lower(c.name) = lower(i.name)
   )
)
insert into ts_clients (client_code, name, sector, markets, is_other, active)
select 'CLI-' || lpad((n.n + f.seq)::text, 3, '0'), f.name, f.sector, '{}'::ts_market[], false, true
  from fresh f cross join next_code n;
