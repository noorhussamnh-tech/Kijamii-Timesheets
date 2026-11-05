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
-- The month so far, on the same rule: finished working days only, today
-- excluded. On the 1st of a month nothing has finished, so it falls back to
-- the whole of last month rather than reporting a capacity of zero.
mwin as (
  select case when exists (
           select 1 from params p,
                generate_series(date_trunc('month', p.today)::date, p.today - 1, interval '1 day') g
            where extract(dow from g) not in (5,6))
         then (select date_trunc('month', today)::date from params)
         else (select (date_trunc('month', today) - interval '1 month')::date from params) end as ms,
         case when exists (
           select 1 from params p,
                generate_series(date_trunc('month', p.today)::date, p.today - 1, interval '1 day') g
            where extract(dow from g) not in (5,6))
         then (select today - 1 from params)
         else (select (date_trunc('month', today) - interval '1 day')::date from params) end as me
),
mdays as (
  select g::date as d from mwin, generate_series(mwin.ms, mwin.me, interval '1 day') g
   where extract(dow from g) not in (5,6)
),
mgrs(label, mgr_name, mgr_email) as (values
  ('Nadia',       'Nadia Mohamed Hesham Aly Elsayed Hassan',       'nadia.hesham@kijamii.com'),
  ('Marina',      'Marina Youssef Youhana Melika',                  'marina.youssef@kijamii.com'),
  ('Emad Mutter', 'Emad El-din Mohamed Mutter Abdel Khalek Mutter', 'emad.mutter@kijamii.com'),
  ('Ramy Kamel',  'Ramy Kamel Mohamed Taher Omar',                  'ramy.kamel@kijamii.com')
),
cohort as (
  select distinct m.label as team, d.email, 'Member'::text as seat
    from mgrs m join ts_employee_directory d on d.manager = m.mgr_name
  union select m.label, m.mgr_email, 'Lead' from mgrs m
),
ids as (select e.id from cohort c join ts_employees e on e.email = c.email)
select jsonb_build_object(
  'snapshot', to_char(now() at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI') || ' Cairo',
  'week', jsonb_build_object(
     'start', (select ws from win),
     'end',   (select we from win),
     'days',  (select count(*) from wdays),
     'label', to_char((select ws from win), 'FMDD Mon') || ' – ' ||
              to_char((select we from win), 'FMDD Mon')),
  'month', jsonb_build_object(
     'start', (select ms from mwin),
     'end',   (select me from mwin),
     'days',  (select count(*) from mdays),
     'label', to_char((select ms from mwin), 'FMDD Mon') || ' – ' ||
              to_char((select me from mwin), 'FMDD Mon')),
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
       'function', coalesce(nullif(btrim(dd.function), ''), 'Not set'),
       'entity',   coalesce(nullif(btrim(dd.entity), ''), 'Not set'))
       order by c.team, c.seat, e.full_name)
     from cohort c join ts_employees e on e.email = c.email
     left join ts_employee_directory dd on dd.email = c.email),
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
            group by 1 having sum(x.hours) > 0) q)
) as payload;
