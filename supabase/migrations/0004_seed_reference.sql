-- Reference data.
--
-- Clients come from the 44 real records in the Kijamii Prism database, and
-- their market mapping is derived from Prism's job-book entries rather than
-- guessed. A client with an empty markets array is visible to every market;
-- that is the deliberate default for the clients Prism has no regional
-- bookings for yet, so nobody is blocked from logging real work.
--
-- Services, project types and tasks are the timesheet's own vocabulary (what
-- a person did), which is a different taxonomy from Prism's service lines
-- (how revenue is booked). They are kept separate on purpose.

insert into ts_clients (client_code, name, sector, markets) values
  ('CLI-001', 'Amana Foods',        'F&B',                            '{}'),
  ('CLI-002', 'Bainkom',            'Financial Services',             '{UAE}'),
  ('CLI-003', 'Baskin Robbins',     'QSR & F&B',                      '{UAE}'),
  ('CLI-004', 'Bioderma',           'Healthcare & Beauty',            '{}'),
  ('CLI-005', 'BTC',                'Technology & Telecom',           '{EG}'),
  ('CLI-006', 'Burger King',        'QSR & F&B',                      '{}'),
  ('CLI-007', 'California Garden',  'FMCG & Food',                    '{UAE}'),
  ('CLI-008', 'Carrefour',          'Retail',                         '{}'),
  ('CLI-009', 'Castrol Oil',        'Automotive & Mobility',          '{EG}'),
  ('CLI-010', 'Changan',            'Automotive & Mobility',          '{KSA}'),
  ('CLI-011', 'Deepal',             'Automotive & Mobility',          '{KSA}'),
  ('CLI-012', 'Dettol',             'FMCG & Personal Care',           '{}'),
  ('CLI-013', 'ENBD',               'Financial Services',             '{}'),
  ('CLI-014', 'EZ Bank',            'Financial Services',             '{}'),
  ('CLI-015', 'GAC',                'Automotive & Mobility',          '{KSA}'),
  ('CLI-016', 'Garnier',            'Beauty & Personal Care',         '{}'),
  ('CLI-017', 'GB Bus',             'Automotive & Mobility',          '{}'),
  ('CLI-018', 'GB Corp',            'Automotive & Mobility',          '{}'),
  ('CLI-019', 'Glade',              'FMCG & Home Care',               '{EG}'),
  ('CLI-020', 'Glycolic Gloss',     'Beauty & Personal Care',         '{}'),
  ('CLI-021', 'Google',             'Technology & Platforms',         '{UAE}'),
  ('CLI-022', 'Gulf Oil',           'Automotive & Mobility',          '{UAE}'),
  ('CLI-023', 'H&S',                'Beauty & Personal Care',         '{}'),
  ('CLI-024', 'Indomie',            'FMCG & Food',                    '{}'),
  ('CLI-025', 'Keeta',              'Technology & Delivery',          '{KSA}'),
  ('CLI-026', 'KFH',                'Financial Services',             '{EG}'),
  ('CLI-027', 'KIA',                'Automotive & Mobility',          '{EG}'),
  ('CLI-028', 'Limitless Naturals', 'Health & Wellness',              '{}'),
  ('CLI-029', 'MYF',                'Healthcare',                     '{EG}'),
  ('CLI-030', 'Opella',             'Healthcare',                     '{EG}'),
  ('CLI-031', 'Oppo',               'Technology & Electronics',       '{}'),
  ('CLI-032', 'Orange Corners',     'Entrepreneurship & Government',  '{}'),
  ('CLI-033', 'PlayStation',        'Gaming & Entertainment',         '{}'),
  ('CLI-034', 'Popeye''s',          'QSR & F&B',                      '{KSA}'),
  ('CLI-035', 'PUBG',               'Gaming & Entertainment',         '{}'),
  ('CLI-036', 'Rauch',              'FMCG & Beverages',               '{EG}'),
  ('CLI-037', 'Saldwich',           'QSR & F&B',                      '{KSA}'),
  ('CLI-038', 'ShoeMart',           'Retail & Fashion',               '{UAE}'),
  ('CLI-039', 'Tim Hortons',        'QSR & F&B',                      '{KSA}'),
  ('CLI-040', 'TTCX',               'Technology & Telecom',           '{}'),
  ('CLI-041', 'Valmore',            'Investment & Holdings',          '{EG}'),
  ('CLI-042', 'Visa',               'Financial Services',             '{}'),
  ('CLI-043', 'Yango Play',         'Media & Entertainment',          '{UAE}'),
  ('CLI-044', 'Zahran',             'Retail & Consumer Goods',        '{EG}');

-- The single free-text escape hatch, available in every market.
insert into ts_clients (client_code, name, markets, is_other)
values ('CLI-OTHER', 'Other (please fill in)', '{}', true);

insert into ts_services (service_code, name, sort_order) values
  ('art-design',           'Art & Design',         10),
  ('copywriting',          'Copywriting',          20),
  ('community-management', 'Community Management', 30),
  ('consumer-insights',    'Consumer Insights',    40),
  ('media-buying',         'Media Buying',         50),
  ('motion',               'Motion',               60),
  ('production',           'Production',           70),
  ('account-management',   'Account Management',   80);

insert into ts_project_types (name, sort_order) values
  ('Monthly Social Calendar', 10),
  ('Amend',                   20),
  ('Campaign',                30),
  ('Pop Up',                  40),
  ('Greeting',                50),
  ('Master Visual',           60),
  ('Pitch',                   70);

insert into ts_task_types (name, sort_order) values
  ('Key Visual',            10),
  ('Still Image',           20),
  ('GIF',                   30),
  ('Video',                 40),
  ('Copy',                  50),
  ('Script',                60),
  ('Brainstorming',         70),
  ('Briefing',              80),
  ('Illustration',          90),
  ('Attending Shoot',      100),
  ('Crisis Management',    110),
  ('Moderation',           120),
  ('Flagging & Monitoring',130),
  ('Reporting',            140);

-- The four capability verticals from the prototype are folded in here, per
-- the decision to drop verticals in favour of market + department.
insert into ts_departments (name, sort_order) values
  ('Account Management', 10),
  ('Creative',           20),
  ('Strategy',           30),
  ('Media Buying',       40),
  ('Consumer Insights',  50),
  ('Production',         60),
  ('Entertainment',      70),
  ('Technology',         80),
  ('Operations',         90);
