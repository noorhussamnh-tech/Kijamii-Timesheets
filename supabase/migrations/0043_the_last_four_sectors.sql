-- 0043: the four accounts that had no sector.
--
-- AlHoboob Sports, Hana FMCG, Yasmina Technology, EBC FinTech.
--
-- "Gin Tech" in the request is read as FinTech -- G and F are adjacent keys,
-- and EBC is a payments business. Trivially corrected if that is wrong.
--
-- Recorded as given rather than folded into the nearest existing value. The
-- list already carries four FMCG sub-sectors and four Technology ones, so
-- these are near-duplicates -- but nothing groups by sector. It is a label
-- under the client name in the picker, nothing more, so the honest value
-- beats a tidier one that guesses which sub-sector an account belongs to.

update ts_clients set sector = v.sector, updated_at = now()
  from (values
    ('alhoboob', 'Sports'),
    ('hana',     'FMCG'),
    ('yasmina',  'Technology'),
    ('ebc',      'FinTech')
  ) as v(name, sector)
 where lower(ts_clients.name) = v.name;

do $$
declare blank int;
begin
  select count(*) into blank from ts_clients
   where sector is null and not is_other;
  if blank <> 0 then
    raise exception '% clients still have no sector', blank;
  end if;
end $$;
