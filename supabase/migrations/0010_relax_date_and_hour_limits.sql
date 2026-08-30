-- People work weekends, and they log time when it suits them. The date rules
-- were getting in the way of real use, so the only limits that remain are the
-- ones that keep the data meaningful: hours must be positive, in quarter
-- increments, and no more than 16 in a day.
--
-- Removed here: the future-date check in ts_validate_week, the future-week
-- refusals in ts_save_draft and ts_submit_week, and the 24-hour ceiling.
-- The full bodies of the three functions are reapplied because Postgres has
-- no partial function edit; only the noted rules differ from migration 0003.

alter table ts_entries drop constraint if exists ts_entries_hours_valid;

alter table ts_entries add constraint ts_entries_hours_valid check (
  hours is null or (hours > 0 and hours <= 16 and mod(hours * 4, 1) = 0)
);
-- See the applied migration 'relax_date_and_hour_limits' for the three
-- function bodies, which differ from 0003 only by the removed date rules
-- and the 16-hour ceiling.
