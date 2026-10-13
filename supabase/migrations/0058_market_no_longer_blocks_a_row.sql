-- Market stopped being something this company manages by, but ts_entries.market
-- was still NOT NULL, so every row still had to name one.
--
-- ts_save_draft derives it from the person: with no client it is their
-- primary_market, and with a client it is still their primary_market unless the
-- account narrows the choice. Four people carry no market at all -- markets '{}'
-- and primary_market null -- so the derived value was null and the insert was
-- rejected outright. They could type a whole day in and lose it to "Something
-- went wrong", and nothing on the screen could have told them why.
--
-- Dropping the requirement rather than inventing a market for them: the column
-- stays so the rows logged while market still meant something keep their value,
-- but a row no longer has to claim a market the company no longer manages by.
--
-- The one read that filters on it is ts_export_time_dedication, a market-era
-- report that is passed the markets it wants; rows without one now fall outside
-- it, which is the honest answer for work that belongs to no market.

alter table public.ts_entries alter column market drop not null;
