-- The daily sweep: everything that can quietly go wrong with this data.
--
-- Written after a scan on 26 November turned up four faults that had been
-- running unnoticed for weeks -- 343 h of work in no view at all, a man marked
-- on leave while logging 99 h, weekend work falling out of three windows, and
-- two blocks of the same page disagreeing about the same month. None of them
-- announced itself. Nothing was looking.
--
-- Returns ONE text column, `payload`: a JSON array of findings. An empty array
-- means the data is clean. Each finding is
--   {sev, check, detail, n, hours}
-- where sev is:
--   alarm -- somebody's work is invisible, or two figures disagree. Mail today.
--   watch -- worth a human knowing, not worth waking anybody.
--
-- The cohort here MUST match the one in ../adoption-report/query.sql. If that
-- rule changes, change it in both or this sweep will cheerfully report that the
-- report is wrong when it is the sweep that is out of date.
--
-- Read-only. It selects and nothing else.
with recursive
params as (select current_date as today),
mgrs(label, mgr_name, mgr_email, launch) as (values
  ('Nadia',       'Nadia Mohamed Hesham Aly Elsayed Hassan',       'nadia.hesham@kijamii.com', date '2026-10-16'),
  ('Marina',      'Marina Youssef Youhana Melika',                  'marina.youssef@kijamii.com', date '2026-10-01'),
  ('Emad Mutter', 'Emad El-din Mohamed Mutter Abdel Khalek Mutter', 'emad.mutter@kijamii.com', date '2026-10-16'),
  ('Ramy Kamel',  'Ramy Kamel Mohamed Taher Omar',                  'ramy.kamel@kijamii.com',  date '2026-10-01')
),
tree as (
  select m.label as team, m.launch, d.email, d.full_name, 1 as depth,
         array[lower(d.email)] as seen
    from mgrs m join ts_employee_directory d on d.manager = m.mgr_name
  union all
  select t.team, t.launch, d.email, d.full_name, t.depth + 1, t.seen || lower(d.email)
    from tree t join ts_employee_directory d on d.manager = t.full_name
   where t.depth < 6 and not (lower(d.email) = any (t.seen))
),
cohort as (
  select distinct on (email) team, launch, email, seat
    from (select team, launch, email, 'Member'::text as seat, depth from tree
          union all
          select label, launch, mgr_email, 'Lead', 0 from mgrs) q
   order by email, depth, team
),
ids as (select e.id from cohort c join ts_employees e on e.email = c.email),
-- Known and deliberately out of scope, decided 26 Nov. Anybody else logging
-- from outside the cohort is a finding.
excused(email) as (values ('noor.hussam@kijamii.com'), ('shahira.elmahdy@kijamii.com')),

f as (
  -- ------------------------------------------------------------------ alarm
  select 10 as ord, 'alarm' as sev, 'Logging but not in the report' as title,
         e.full_name || ' (' || coalesce(nullif(btrim(max(d.manager)),''),'no manager in the OPS list')
           || '), last logged ' || max(x.work_date)::text as detail,
         count(*) as n, sum(x.hours) as hours
    from ts_entries x
    join ts_employees e on e.id = x.employee_id
    left join ts_employee_directory d on d.email = e.email
   where x.hours is not null
     and not exists (select 1 from ids i where i.id = x.employee_id)
     and lower(e.email) not in (select lower(email) from excused)
   group by e.full_name

  -- The cross-check that the two halves of the page agree about the current
  -- month lives in sweep.py, not here: both sides of it are the same SQL now,
  -- so comparing them in SQL would only ever compare an expression to itself.
  -- sweep.py reads the report's own payload and checks the figures the page
  -- actually renders.

  union all
  select 30, 'alarm', 'In the pilot but cannot log (no sign-in record)',
         c.email, 1, null
    from cohort c where not exists (select 1 from ts_employees e where e.email = c.email)

  union all
  select 40, 'alarm', 'One email, more than one person',
         lower(d.email) || ' -> ' || string_agg(distinct d.full_name, ' | '), count(*), null
    from ts_employee_directory d group by lower(d.email) having count(distinct d.full_name) > 1

  union all
  select 41, 'alarm', 'One name, more than one directory row',
         d.full_name || ' -> ' || string_agg(d.email, '; '), count(*), null
    from ts_employee_directory d group by d.full_name having count(*) > 1

  union all
  select 50, 'alarm', 'Entry dated in the future',
         e.full_name || ' ' || x.work_date::text, 1, x.hours
    from ts_entries x join ts_employees e on e.id = x.employee_id
   where x.work_date > (select today from params) and x.hours is not null

  union all
  select 51, 'alarm', 'Impossible hours on one entry',
         e.full_name || ' ' || x.work_date::text || ' = ' || x.hours::text || ' h', 1, x.hours
    from ts_entries x join ts_employees e on e.id = x.employee_id
   where x.hours is not null and (x.hours <= 0 or x.hours > 16)

  union all
  select 52, 'alarm', 'More than 24 h logged in one day',
         q.nm || ' ' || q.d::text || ' = ' || q.h::text || ' h', 1, q.h
    from (select e.full_name as nm, x.work_date as d, sum(x.hours) as h
            from ts_entries x join ts_employees e on e.id = x.employee_id
           where x.hours is not null group by 1,2 having sum(x.hours) > 24) q

  union all
  select 60, 'alarm', 'Entry points at a client row that does not exist',
         'client_id ' || x.client_id::text, count(*), sum(x.hours)
    from ts_entries x
   where x.client_id is not null
     and not exists (select 1 from ts_clients c where c.id = x.client_id)
   group by x.client_id

  union all
  select 61, 'alarm', 'Submission state is inconsistent',
         q.what, q.n, null
    from (select 'submitted with no submitted_at' as what, count(*) as n from ts_entries
           where status = 'submitted' and submitted_at is null
          union all
          select 'draft that carries a submitted_at', count(*) from ts_entries
           where status = 'draft' and submitted_at is not null
          union all
          select 'week_start does not match work_date', count(*) from ts_entries
           where week_start is not null
             and week_start <> (work_date - (extract(dow from work_date)::int % 7))) q
   where q.n > 0

  union all
  select 70, 'alarm', 'Backfill window is not 90 open days',
         'open_days=' || b.open_days::text || ' open_until=' || coalesce(b.open_until::text,'none'),
         1, null
    from ts_backfill_window b
   where b.open_days <> 90 or b.open_until is not null

  -- ------------------------------------------------------------------ watch
  union all
  select 100, 'watch', 'Draft hours against a month already closed',
         e.full_name || ', ' || to_char(date_trunc('month', x.work_date),'Mon YYYY'),
         count(*), sum(x.hours)
    from ts_entries x join ts_employees e on e.id = x.employee_id
   where x.employee_id in (select id from ids) and x.status = 'draft' and x.hours is not null
     and x.work_date < date_trunc('month',(select today from params))::date
   group by 1,2,3,4

  union all
  select 110, 'watch', 'Row saved with no hours on it',
         e.full_name || ' ' || x.work_date::text, count(*), null
    from ts_entries x join ts_employees e on e.id = x.employee_id
   where x.hours is null and x.employee_id in (select id from ids)
   group by 1,2,3,4

  union all
  select 120, 'watch', 'Entry cannot be submitted: no project type',
         e.full_name, count(*), sum(x.hours)
    from ts_entries x join ts_employees e on e.id = x.employee_id
   where x.employee_id in (select id from ids) and x.hours is not null
     and coalesce(btrim(x.project_type),'') = ''
   group by e.full_name

  union all
  -- A row is unnamed when the name the report would print for it is the
  -- placeholder itself. That name is resolved the same way the report resolves
  -- it -- client row first, then the free-text field -- because testing the
  -- columns separately misses whichever of the two the person actually used.
  select 130, 'watch', 'Hours booked to a placeholder instead of a client, this month',
         round(100.0 * sum(x.hours) / nullif((select sum(y.hours) from ts_entries y
             where y.employee_id in (select id from ids) and y.hours is not null
               and y.work_date >= date_trunc('month',(select today from params))::date),0))::text
           || '% of everything logged this month',
         count(*), sum(x.hours)
    from ts_entries x
    left join ts_clients cl on cl.id = x.client_id
   where x.employee_id in (select id from ids) and x.hours is not null
     and x.work_date >= date_trunc('month',(select today from params))::date
     and (lower(coalesce(cl.name, nullif(btrim(x.client_other),''), 'Not named')) like 'other%'
          or coalesce(cl.name, nullif(btrim(x.client_other),''), 'Not named') = 'Not named')
  having sum(x.hours) > 0

  union all
  select 140, 'watch', 'In the OPS list but has never opened the tool',
         c.team || ': ' || e.full_name, count(*), null
    from cohort c join ts_employees e on e.email = c.email
   where e.auth_user_id is null
   group by 1,2,3,4

  union all
  select 150, 'watch', 'Blank Entity in the OPS list, so their entries carry no market',
         string_agg(d.full_name, '; ' order by d.full_name), count(*), null
    from cohort c join ts_employee_directory d on d.email = c.email
   where coalesce(btrim(d.entity),'') = ''
  having count(*) > 0
)
select coalesce(jsonb_agg(jsonb_build_object(
         'sev', sev, 'title', title, 'detail', detail,
         'n', n, 'hours', hours) order by ord, hours desc nulls last), '[]'::jsonb)::text as payload
  from f;
