-- 0041: Carrefour and Visa were pitches, not accounts.
--
-- Deactivated rather than deleted. Carrefour carries 4 logged entries and 18
-- hours -- that work happened, and deleting the client would either be
-- refused by the foreign key or would take real history with it. Visa has no
-- entries and could have been deleted outright, but a pitch can convert, and
-- one flag is easier to reverse than a re-insert with a new id.
--
-- Deactivating removes them from the client picker on the timesheet and from
-- anything that reads active clients. Past entries keep pointing at them, so
-- the 18 hours stay where they are in history, correctly.

update ts_clients
   set active = false, updated_at = now()
 where lower(name) in ('carrefour', 'visa')
   and active;

do $$
declare still_on int;
begin
  select count(*) into still_on from ts_clients
   where lower(name) in ('carrefour', 'visa') and active;
  if still_on <> 0 then
    raise exception 'expected both to be off, % still active', still_on;
  end if;
end $$;
