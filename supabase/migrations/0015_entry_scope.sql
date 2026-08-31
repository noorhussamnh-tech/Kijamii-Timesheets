-- Whether an hour was inside what the client contracted for.
--
-- This is the question a job book cannot answer from hours alone: forty hours
-- on a brand reads the same whether the work was scoped or given away. Marking
-- it at the row makes scope creep countable instead of anecdotal.
--
-- It defaults to in-scope because most work is, and a default that is usually
-- right beats a blank that is always useless. The consequence is worth stating:
-- out-of-scope has to be chosen deliberately, so this will under-count rather
-- than over-count it. Under-counting is the safer error for a number that
-- ends up in a conversation with a client.

create type ts_scope as enum ('in_scope', 'out_of_scope');

alter table ts_entries
  add column scope ts_scope not null default 'in_scope';

comment on column ts_entries.scope is
  'Whether the hour fell inside the client''s contracted scope. Defaults to in_scope; out_of_scope is always a deliberate choice.';
