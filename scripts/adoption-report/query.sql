-- Every figure the adoption report needs, as one JSON object.
--
-- Entirely date-relative: it resolves "the current week" from the day it runs,
-- so a scheduled run on any morning needs no editing. Returns a single column
-- named `payload`, which render.py reads on stdin.
--
-- The pilot is the four launch leads plus everyone the staff directory lists as
-- reporting to them. Leads are matched by email because the directory writes a
-- manager's full legal name while ts_employees holds the short one.
with
params as (
  select current_date as today,
         current_date - (extract(dow from current_date)::int % 7) as wk_start
),
win as (
  -- The completed working days (Sun-Thu) of the current week. On a Sunday none
  -- have finished yet, so fall back to the week before, which is the last full
  -- one; utilisation then describes a real week instead of dividing by zero.
  select case when exists (
           select 1 from params p, generate_series(p.wk_start, p.today - 1, interval '1 day') g
            where extract(dow from g) not in (5,6))
         then (select wk_start from params)
         else (select wk_start - 7 from params) end as ws,
         case when exists (
           select 1 from params p, generate_series(p.wk_start, p.today - 1, interval '1 day') g
            where extract(dow from g) not in (5,6))
         then (select today - 1 from params)
         else (select wk_start - 3 from params) end as we
),
wdays as (
  select g::date as d from win, generate_series(win.ws, win.we, interval '1 day') g
   where extract(dow from g) not in (5,6)
),
-- The month to date: the 1st of the current month through today, today
-- included. It used to stop at yesterday, on the grounds that an unfinished
-- day divides badly -- but a report headed "month so far" that leaves out the
-- morning it is read on is answering a question nobody asked. Today is in the
-- window; `days_done` and `cap_done` carry the finished-days figures beside it
-- so the partial day can be stated rather than hidden.
--
-- The fallback survives for the one day it is needed: a month whose 1st falls
-- on a Friday has no working day until the 3rd, and dividing by a capacity of
-- zero is worse than showing last month.
mwin as (
  select case when exists (
           select 1 from params p,
                generate_series(date_trunc('month', p.today)::date, p.today, interval '1 day') g
            where extract(dow from g) not in (5,6))
         then (select date_trunc('month', today)::date from params)
         else (select (date_trunc('month', today) - interval '1 month')::date from params) end as ms,
         case when exists (
           select 1 from params p,
                generate_series(date_trunc('month', p.today)::date, p.today, interval '1 day') g
            where extract(dow from g) not in (5,6))
         then (select today from params)
         else (select (date_trunc('month', today) - interval '1 day')::date from params) end as me
),
-- The same window, minus today: what a finished-days comparison divides by.
mdone as (
  select mwin.ms as ms, least(mwin.me, (select today - 1 from params)) as me from mwin
),
-- Every month of the pilot, each ending today if it is the current one. The
-- month-over-month section reads these; capacity is measured from each
-- person's own launch date inside the month, so October does not charge a team
-- for the fortnight before it had the tool.
mons as (
  select g::date as ms,
         least((g + interval '1 month' - interval '1 day')::date, (select today from params)) as me
    from params p, generate_series(date '2026-10-01',
                                   date_trunc('month', p.today), interval '1 month') g
),
-- Last month's working days, numbered, so the current month can be compared
-- against the same number of elapsed days rather than against a full month.
pmdays as (
  select g::date as d, row_number() over (order by g) as n
    from params p, generate_series((date_trunc('month', p.today) - interval '1 month')::date,
                                   (date_trunc('month', p.today) - interval '1 day')::date,
                                   interval '1 day') g
   where extract(dow from g) not in (5,6)
),
mdays as (
  select g::date as d from mwin, generate_series(mwin.ms, mwin.me, interval '1 day') g
   where extract(dow from g) not in (5,6)
),
ppace as (
  select (select min(d) from pmdays) as ps,
         coalesce((select d from pmdays where n = (select count(*) from mdays)),
                  (select max(d) from pmdays)) as pe
),
-- The date each team went live. Ramy Kamel's and Marina's teams started a
-- fortnight before the other two, so comparing their totals rewards whoever
-- started first; every cumulative figure is measured from these instead.
mgrs(label, mgr_name, mgr_email, launch) as (values
  ('Nadia',       'Nadia Mohamed Hesham Aly Elsayed Hassan',       'nadia.hesham@kijamii.com', date '2026-10-16'),
  ('Marina',      'Marina Youssef Youhana Melika',                  'marina.youssef@kijamii.com', date '2026-10-01'),
  ('Emad Mutter', 'Emad El-din Mohamed Mutter Abdel Khalek Mutter', 'emad.mutter@kijamii.com', date '2026-10-16'),
  ('Ramy Kamel',  'Ramy Kamel Mohamed Taher Omar',                  'ramy.kamel@kijamii.com',  date '2026-10-01')
),
cohort as (
  select distinct m.label as team, m.launch, d.email, 'Member'::text as seat
    from mgrs m join ts_employee_directory d on d.manager = m.mgr_name
  union select m.label, m.launch, m.mgr_email, 'Lead' from mgrs m
),
ids as (select e.id from cohort c join ts_employees e on e.email = c.email)
select jsonb_build_object(
  'snapshot', to_char(now() at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI') || ' Cairo',
  'week', jsonb_build_object(
     'start', (select ws from win),
     'end',   (select we from win),
     'days',  (select count(*) from wdays),
     -- Capacity comes from ts_assumed_hours, not from days times eight, so the
     -- page and the app cannot assume different amounts of the same person:
     -- 8 a working day, never more than 160 in a calendar month.
     'cap',   ts_assumed_hours((select ws from win), (select we from win), 40),
     'label', to_char((select ws from win), 'FMDD Mon') || ' – ' ||
              to_char((select we from win), 'FMDD Mon')),
  'month', jsonb_build_object(
     'start', (select ms from mwin),
     'end',   (select me from mwin),
     'days',  (select count(*) from mdays),
     'cap',   ts_assumed_hours((select ms from mwin), (select me from mwin), 40),
     'label', to_char((select ms from mwin), 'FMDD Mon') || ' – ' ||
              to_char((select me from mwin), 'FMDD Mon'),
     'key',   to_char((select ms from mwin), 'YYYY-MM'),
     -- Today is in the window above. These two describe the same window with
     -- today taken out, which is the only honest denominator before the day is
     -- over: a capture rate that counts eight unlived hours reads as a
     -- collapse every morning.
     'days_done', (select count(*) from mdone m,
                        generate_series(m.ms, m.me, interval '1 day') g
                    where extract(dow from g) not in (5,6)),
     'cap_done',  (select ts_assumed_hours(m.ms, m.me, 40) from mdone m),
     'open',      (select (select me from mwin) = p.today
                     and extract(dow from p.today) not in (5,6) from params p),
     'today',     to_char((select today from params), 'FMDD Mon'),
     'today_h',   coalesce((select sum(x.hours) from ts_entries x
                    where x.employee_id in (select id from ids)
                      and x.work_date = (select today from params)), 0),
     'today_n',   coalesce((select count(distinct x.employee_id) from ts_entries x
                    where x.employee_id in (select id from ids) and x.hours is not null
                      and x.work_date = (select today from params)), 0)),
  'people', (select jsonb_agg(jsonb_build_object(
       'team', c.team, 'seat', c.seat, 'name', e.full_name,
       'signed_in', e.auth_user_id is not null,
       'days',  coalesce((select count(distinct x.work_date) from ts_entries x
                           where x.employee_id = e.id and x.hours is not null), 0),
       'hours', coalesce((select sum(x.hours) from ts_entries x
                           where x.employee_id = e.id), 0),
       'draft_rows',  coalesce((select count(*) from ts_entries x
                           where x.employee_id = e.id and x.status = 'draft'), 0),
       'draft_hours', coalesce((select sum(x.hours) from ts_entries x
                           where x.employee_id = e.id and x.status = 'draft'), 0),
       'last', (select max(x.work_date)::text from ts_entries x
                 where x.employee_id = e.id and x.hours is not null),
       'week_days', coalesce((select count(distinct x.work_date) from ts_entries x
                           where x.employee_id = e.id and x.hours is not null
                             and x.work_date in (select d from wdays)), 0),
       'wk_hours',  coalesce((select sum(x.hours) from ts_entries x
                           where x.employee_id = e.id
                             and x.work_date in (select d from wdays)), 0),
       'mt_days', coalesce((select count(distinct x.work_date) from ts_entries x
                           where x.employee_id = e.id and x.hours is not null
                             and x.work_date in (select d from mdays)), 0),
       'mt_hours', coalesce((select sum(x.hours) from ts_entries x
                           where x.employee_id = e.id
                             and x.work_date in (select d from mdays)), 0),
       -- Today, on its own. The month-to-date window includes today, and the
       -- page states what the same figures read without it; doing that from a
       -- cohort-wide total would be wrong by whatever somebody on leave logged.
       'today_h', coalesce((select sum(x.hours) from ts_entries x
                           where x.employee_id = e.id
                             and x.work_date = (select today from params)), 0),
       'function', coalesce(nullif(btrim(dd.function), ''), 'Not set'),
       'entity',   coalesce(nullif(btrim(dd.entity), ''), 'Not set'),
       'launch',  to_char(c.launch, 'FMDD Mon'),
       'ldays',   (select count(*) from generate_series(c.launch, (select we from win), interval '1 day') g
                    where extract(dow from g) not in (5,6)),
       -- Each team's own runway crosses months, and the 160 ceiling is monthly,
       -- so this is summed month by month rather than ldays times eight.
       'lcap',    ts_assumed_hours(c.launch, (select we from win), 40),
       'llogged', coalesce((select count(distinct x.work_date) from ts_entries x
                    where x.employee_id = e.id and x.hours is not null
                      and x.work_date between c.launch and (select we from win)
                      and extract(dow from x.work_date) not in (5,6)), 0),
       'lhours',  coalesce((select sum(x.hours) from ts_entries x
                    where x.employee_id = e.id
                      and x.work_date between c.launch and (select we from win)
                      and extract(dow from x.work_date) not in (5,6)), 0))
       order by c.team, c.seat, e.full_name)
     from cohort c join ts_employees e on e.email = c.email
     left join ts_employee_directory dd on dd.email = c.email),
  'launches', (select jsonb_agg(jsonb_build_object(
       'team', label, 'date', to_char(launch, 'FMDD Mon'),
       'days', (select count(*) from generate_series(launch, (select we from win), interval '1 day') g
                 where extract(dow from g) not in (5,6))) order by launch, label)
     from mgrs),
  'daily', (select jsonb_agg(jsonb_build_object(
       'date', g::date, 'dow', to_char(g, 'Dy'),
       'work', extract(dow from g) not in (5,6),
       'people', coalesce((select count(distinct x.employee_id) from ts_entries x
                   where x.work_date = g::date and x.hours is not null
                     and x.employee_id in (select id from ids)), 0),
       'hours',  coalesce((select sum(x.hours) from ts_entries x
                   where x.work_date = g::date
                     and x.employee_id in (select id from ids)), 0)) order by g)
     from generate_series(date '2026-09-27', (select today from params), interval '1 day') g),

  -- Where the hours went. The three blocks below answer the allocation
  -- questions the headline cannot: which book of business absorbed the week,
  -- which clients, and how much of it was doing something twice.
  --
  -- Capacity is deliberately absent from all three. A person's hours land on
  -- whichever team the client and market resolve to, so one person feeds
  -- several teams in a week; there is no honest per-team denominator, and
  -- inventing one would read as utilisation when it is nothing of the kind.
  'biz', (select coalesce(jsonb_agg(jsonb_build_object(
            'name', name, 'hours', hours, 'week', week, 'mtd', mtd,
            'amend', amend, 'people', people)
            order by hours desc), '[]'::jsonb)
     from (select t.name as name,
                  sum(x.hours) as hours,
                  sum(x.hours) filter (where x.work_date in (select d from wdays)) as week,
                  sum(x.hours) filter (where x.work_date in (select d from mdays)) as mtd,
                  sum(x.hours) filter (where x.work_type = 'amend')               as amend,
                  count(distinct x.employee_id)                                   as people
             from ts_entries x join ts_teams t on t.id = x.team_id
            where x.employee_id in (select id from ids) and x.hours is not null
            group by t.name having sum(x.hours) > 0) q),

  'clients', (select coalesce(jsonb_agg(jsonb_build_object(
            'name', name, 'hours', hours, 'week', week, 'mtd', mtd,
            'amend', amend, 'people', people)
            order by hours desc), '[]'::jsonb)
     from (select coalesce(cl.name, nullif(btrim(x.client_other), ''), 'Not named') as name,
                  sum(x.hours) as hours,
                  sum(x.hours) filter (where x.work_date in (select d from wdays)) as week,
                  sum(x.hours) filter (where x.work_date in (select d from mdays)) as mtd,
                  sum(x.hours) filter (where x.work_type = 'amend')               as amend,
                  count(distinct x.employee_id)                                   as people
             from ts_entries x
             left join ts_clients cl on cl.id = x.client_id
            where x.employee_id in (select id from ids) and x.hours is not null
            group by 1 having sum(x.hours) > 0) q),

  'regions', (select coalesce(jsonb_agg(jsonb_build_object(
            'name', name, 'hours', hours, 'week', week, 'mtd', mtd,
            'amend', amend, 'people', people) order by hours desc), '[]'::jsonb)
     from (select coalesce(x.market::text, 'Not set') as name,
                  sum(x.hours) as hours,
                  sum(x.hours) filter (where x.work_date in (select d from wdays)) as week,
                  sum(x.hours) filter (where x.work_date in (select d from mdays)) as mtd,
                  sum(x.hours) filter (where x.work_type = 'amend') as amend,
                  count(distinct x.employee_id) as people
             from ts_entries x
            where x.employee_id in (select id from ids) and x.hours is not null
            group by 1 having sum(x.hours) > 0) q),

  'functions', (select coalesce(jsonb_agg(jsonb_build_object(
            'name', name, 'hours', hours, 'week', week, 'mtd', mtd,
            'amend', amend, 'people', people) order by hours desc), '[]'::jsonb)
     from (select coalesce(nullif(btrim(d2.function), ''), 'Not set') as name,
                  sum(x.hours) as hours,
                  sum(x.hours) filter (where x.work_date in (select d from wdays)) as week,
                  sum(x.hours) filter (where x.work_date in (select d from mdays)) as mtd,
                  sum(x.hours) filter (where x.work_type = 'amend') as amend,
                  count(distinct x.employee_id) as people
             from ts_entries x
             join ts_employees e2 on e2.id = x.employee_id
             left join ts_employee_directory d2 on d2.email = e2.email
            where x.employee_id in (select id from ids) and x.hours is not null
            group by 1 having sum(x.hours) > 0) q),

  -- Typed but never filed, split by the month the work belongs to.
  --
  -- The daily mail has carried one total for this since the start, which told
  -- nobody which month the hours sat in: 6.5 of Habiba Hany's 14 draft hours
  -- turned out to be October, and that only came out because somebody asked.
  -- `ready` is what could be submitted as it stands; `blocked` still wants a
  -- project type or a work type before the app will take it, which is a
  -- different conversation with a different person.
  'unfiled', (select coalesce(jsonb_agg(jsonb_build_object(
            'name', name, 'month', month, 'hours', hours, 'rows', rows,
            'ready', ready, 'blocked', blocked)
            order by month desc, hours desc), '[]'::jsonb)
     from (select e2.full_name as name,
                  to_char(date_trunc('month', x.work_date), 'YYYY-MM') as month,
                  sum(x.hours)  as hours,
                  count(*)      as rows,
                  coalesce(sum(x.hours) filter (where ts_entry_ready(
                    x.hours, x.client_id, x.client_other, x.project_type, x.work_type)), 0) as ready,
                  coalesce(sum(x.hours) filter (where not ts_entry_ready(
                    x.hours, x.client_id, x.client_other, x.project_type, x.work_type)), 0) as blocked
             from ts_entries x
             join ts_employees e2 on e2.id = x.employee_id
            where x.employee_id in (select id from ids)
              and x.status = 'draft' and x.hours is not null
            group by 1, 2) q),

  'ptypes', (select coalesce(jsonb_agg(jsonb_build_object(
            'name', name, 'hours', hours, 'week', week, 'mtd', mtd, 'amend', amend)
            order by hours desc), '[]'::jsonb)
     from (select coalesce(nullif(btrim(x.project_type), ''), 'Not named') as name,
                  sum(x.hours) as hours,
                  sum(x.hours) filter (where x.work_date in (select d from wdays)) as week,
                  sum(x.hours) filter (where x.work_date in (select d from mdays)) as mtd,
                  sum(x.hours) filter (where x.work_type = 'amend')               as amend
             from ts_entries x
            where x.employee_id in (select id from ids) and x.hours is not null
            group by 1 having sum(x.hours) > 0) q),

  -- ------------------------------------------------------- month over month
  --
  -- One month against the next, which the three rolling windows above cannot
  -- show: they all end today, so none of them says whether this month is
  -- better than the last one. Capacity is measured from each person's own
  -- launch date inside the month, so October is not charged for the fortnight
  -- two of the teams did not yet have the tool.
  --
  -- The current month is partial by definition. `prev_pace` below is the
  -- like-for-like answer: the same number of elapsed working days of the month
  -- before, which is the only comparison that is not rigged by the calendar.
  'months', (select coalesce(jsonb_agg(jsonb_build_object(
        'key',   to_char(m.ms, 'YYYY-MM'),
        'label', to_char(m.ms, 'FMMon YYYY'),
        'start', m.ms, 'end', m.me,
        'partial', m.me < (m.ms + interval '1 month' - interval '1 day')::date,
        'days', (select count(*) from generate_series(m.ms, m.me, interval '1 day') g
                  where extract(dow from g) not in (5,6)),
        'cap', (select coalesce(sum(ts_assumed_hours(greatest(m.ms, c.launch), m.me, 40)), 0)
                  from cohort c join ts_employees e on e.email = c.email),
        'hours', coalesce((select sum(x.hours) from ts_entries x
                   where x.employee_id in (select id from ids)
                     and x.work_date between m.ms and m.me), 0),
        'submitted', coalesce((select sum(x.hours) from ts_entries x
                   where x.employee_id in (select id from ids)
                     and x.work_date between m.ms and m.me and x.status <> 'draft'), 0),
        'draft', coalesce((select sum(x.hours) from ts_entries x
                   where x.employee_id in (select id from ids)
                     and x.work_date between m.ms and m.me and x.status = 'draft'), 0),
        'amend', coalesce((select sum(x.hours) from ts_entries x
                   where x.employee_id in (select id from ids)
                     and x.work_date between m.ms and m.me and x.work_type = 'amend'), 0),
        'active', coalesce((select count(distinct x.employee_id) from ts_entries x
                   where x.employee_id in (select id from ids) and x.hours is not null
                     and x.work_date between m.ms and m.me), 0),
        'clients', coalesce((select count(distinct coalesce(cl.name,
                       nullif(btrim(x.client_other), ''), 'Not named'))
                     from ts_entries x left join ts_clients cl on cl.id = x.client_id
                    where x.employee_id in (select id from ids) and x.hours is not null
                      and x.work_date between m.ms and m.me), 0))
        order by m.ms), '[]'::jsonb)
     from mons m),

  'prev_pace', (select jsonb_build_object(
        'month', to_char(ps, 'YYYY-MM'),
        'label', to_char(ps, 'FMDD Mon') || ' – ' || to_char(pe, 'FMDD Mon'),
        'days',  (select count(*) from pmdays where d <= pe),
        'cap',   (select coalesce(sum(ts_assumed_hours(greatest(ps, c.launch), pe, 40)), 0)
                    from cohort c join ts_employees e on e.email = c.email),
        'hours', coalesce((select sum(x.hours) from ts_entries x
                   where x.employee_id in (select id from ids)
                     and x.work_date between ps and pe), 0),
        'active', coalesce((select count(distinct x.employee_id) from ts_entries x
                   where x.employee_id in (select id from ids) and x.hours is not null
                     and x.work_date between ps and pe), 0))
     from ppace),

  'emp_month', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', e.full_name, 'team', c.team, 'month', to_char(m.ms, 'YYYY-MM'),
        'hours', coalesce((select sum(x.hours) from ts_entries x
                   where x.employee_id = e.id and x.work_date between m.ms and m.me), 0),
        'days', coalesce((select count(distinct x.work_date) from ts_entries x
                   where x.employee_id = e.id and x.hours is not null
                     and x.work_date between m.ms and m.me), 0),
        'cap', ts_assumed_hours(greatest(m.ms, c.launch), m.me, 40))
        order by e.full_name, m.ms), '[]'::jsonb)
     from cohort c
     join ts_employees e on e.email = c.email
     cross join mons m),

  'acct_month', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', name, 'month', month, 'hours', hours, 'people', people)
        order by month, hours desc), '[]'::jsonb)
     from (select coalesce(cl.name, nullif(btrim(x.client_other), ''), 'Not named') as name,
                  to_char(date_trunc('month', x.work_date), 'YYYY-MM') as month,
                  sum(x.hours) as hours,
                  count(distinct x.employee_id) as people
             from ts_entries x left join ts_clients cl on cl.id = x.client_id
            where x.employee_id in (select id from ids) and x.hours is not null
              and x.work_date >= date '2026-10-01'
              and x.work_date <= (select today from params)
            group by 1, 2 having sum(x.hours) > 0) q),

  -- ------------------------------------------------- who works on what, and how much
  --
  -- The client block says a client took 300 hours. It does not say whose. This
  -- crosses the two, so a resourcing conversation can see that one account is
  -- most of one person's month while another is spread thinly over nine.
  'emp_acct', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', name, 'team', team, 'client', client, 'hours', hours,
        'mtd', mtd, 'amend', amend, 'days', days) order by name, hours desc), '[]'::jsonb)
     from (select e.full_name as name, c.team as team,
                  coalesce(cl.name, nullif(btrim(x.client_other), ''), 'Not named') as client,
                  sum(x.hours) as hours,
                  coalesce(sum(x.hours) filter (where x.work_date in (select d from mdays)), 0) as mtd,
                  coalesce(sum(x.hours) filter (where x.work_type = 'amend'), 0) as amend,
                  count(distinct x.work_date) as days
             from ts_entries x
             join ts_employees e on e.id = x.employee_id
             join cohort c on c.email = e.email
             left join ts_clients cl on cl.id = x.client_id
            where x.employee_id in (select id from ids) and x.hours is not null
            group by 1, 2, 3 having sum(x.hours) > 0) q)
) as payload;
