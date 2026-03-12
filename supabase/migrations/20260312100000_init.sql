-- CXDHV Schema — CX Domain Health Visualizer

-- ── DOMAINS ─────────────────────────────────────────────────────
create table public.domains (
  id text primary key,
  label text not null,
  abbr text not null,
  color text not null,
  description text,
  is_team_domain boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── FUNCTIONS ───────────────────────────────────────────────────
create table public.functions (
  id text primary key,
  domain_id text not null references public.domains(id) on delete cascade,
  label text not null,
  description text,
  weight numeric(4,2) not null default 1.0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── SIGNALS ─────────────────────────────────────────────────────
-- For standard domains: one row per (function × signal_dimension)
-- For team domain: one row per (function × team_member)
create table public.signals (
  id text primary key,
  function_id text not null references public.functions(id) on delete cascade,
  label text not null,
  score numeric(5,1) not null default 50,
  source text not null default 'manual' check (source in ('manual', 'api', 'survey')),
  source_ref text,  -- optional: external ID or URL for api-sourced signals
  role text,        -- team domain only: Manager, FDE, CS
  updated_at timestamptz not null default now()
);

-- ── SURVEY RESPONSES ────────────────────────────────────────────
-- Raw anonymous responses from Google Form imports
create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,  -- groups responses from same import
  function_id text not null references public.functions(id) on delete cascade,
  signal_label text not null,  -- matches signal label (e.g. "Process Clarity")
  score numeric(5,1) not null,
  submitted_at timestamptz not null default now()
);

-- ── INDEXES ─────────────────────────────────────────────────────
create index idx_functions_domain on public.functions(domain_id);
create index idx_signals_function on public.signals(function_id);
create index idx_survey_batch on public.survey_responses(batch_id);
create index idx_survey_function on public.survey_responses(function_id);

-- ── UPDATED_AT TRIGGER ──────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger domains_updated_at before update on public.domains
  for each row execute function public.set_updated_at();
create trigger functions_updated_at before update on public.functions
  for each row execute function public.set_updated_at();
create trigger signals_updated_at before update on public.signals
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────
-- Public read for dashboard, authenticated write for admin
alter table public.domains enable row level security;
alter table public.functions enable row level security;
alter table public.signals enable row level security;
alter table public.survey_responses enable row level security;

-- Anyone can read (dashboard is public)
create policy "Public read domains" on public.domains for select using (true);
create policy "Public read functions" on public.functions for select using (true);
create policy "Public read signals" on public.signals for select using (true);

-- Authenticated users can write
create policy "Auth write domains" on public.domains for all using (auth.role() = 'authenticated');
create policy "Auth write functions" on public.functions for all using (auth.role() = 'authenticated');
create policy "Auth write signals" on public.signals for all using (auth.role() = 'authenticated');
create policy "Auth write survey" on public.survey_responses for all using (auth.role() = 'authenticated');

-- ── SEED DATA ───────────────────────────────────────────────────

-- Domains
insert into public.domains (id, label, abbr, color, description, is_team_domain, sort_order) values
  ('dops', 'Deployed Operations', 'DOPS', '#38bdf8', '9 FDEs + 1 CS executing onboardings, support requests, and field documentation.', false, 0),
  ('voc',  'Voice of Customer',   'VOC',  '#fb923c', 'Most critical, least systemized. Field intelligence feeding product roadmap, QA, and BVA.', false, 1),
  ('cs',   'Customer Support',    'CS',   '#f472b6', 'Ticket management, technical resolution, and satisfaction measurement.', false, 2),
  ('ops',  'Internal Operations', 'OPS',  '#34d399', 'Training content, knowledge base health, and upward reporting to VP.', false, 3),
  ('team', 'Team Health',         'TEAM', '#a78bfa', 'Team-level health scored per individual across travel load, team satisfaction, and company satisfaction.', true, 4);

-- Functions
insert into public.functions (id, domain_id, label, description, weight, sort_order) values
  -- DOPS
  ('onboardings',    'dops', 'Onboardings',         'Every purchase includes a customer onboarding.',              0.38, 0),
  ('cx_requests',    'dops', 'CX Support Requests',  'BD-initiated requests routed to FDEs.',                      0.38, 1),
  ('field_docs',     'dops', 'Field Documentation',  'Trip reports and field logs per engagement.',                 0.24, 2),
  -- VOC
  ('voc_loop',       'voc',  'VOC Feedback Loop',    'Capture and route customer feedback into BVA and product pipeline.', 0.40, 0),
  ('bug_reporting',  'voc',  'Bug Reporting',        'Field-identified bugs submitted to QA via Jira.',            0.35, 1),
  ('cust_zero',      'voc',  'Customer Zero Testing', 'Early product testing with select customer partners.',      0.25, 2),
  -- CS
  ('ticket_mgmt',    'cs',   'Ticket Management',    'Routing, SLA tracking, and throughput of inbound tickets.',  0.35, 0),
  ('tech_resolution','cs',   'Technical Resolution',  'FDE-backed SME coverage for complex technical issues.',     0.40, 1),
  ('csat_nps',       'cs',   'CSAT / NPS',           'Survey generation habit and automated NPS. Critical gap.',   0.25, 2),
  -- OPS
  ('training',       'ops',  'Training Content',     'FDE-generated training materials for internal teams and new hires.', 0.35, 0),
  ('knowledge_base', 'ops',  'Knowledge Base',       'Maintenance of internal knowledge resources — accuracy, coverage, findability.', 0.35, 1),
  ('reporting',      'ops',  'Upward Reporting',     'Regular reporting cadence to VP — trends, team performance, customer pulse.', 0.30, 2),
  -- TEAM
  ('travel_load',    'team', 'Travel Load / PTO',    'Balance between travel requirements and rest/PTO.',          0.35, 0),
  ('team_sat',       'team', 'Team Satisfaction',     'Individual satisfaction with team dynamics and management.', 0.35, 1),
  ('company_sat',    'team', 'Company Satisfaction',  'Individual satisfaction with company direction and career trajectory.', 0.30, 2);

-- Signals — Standard domains (5 signal dimensions per function)
-- DOPS: Onboardings
insert into public.signals (id, function_id, label, score) values
  ('onboardings_clarity',        'onboardings', 'Process Clarity',             52),
  ('onboardings_accuracy',       'onboardings', 'Process Accuracy',            61),
  ('onboardings_system',         'onboardings', 'System Functionality',        55),
  ('onboardings_accountability', 'onboardings', 'Accountability & Visibility', 44),
  ('onboardings_effectiveness',  'onboardings', 'Overall Effectiveness',       58);
-- DOPS: CX Support Requests
insert into public.signals (id, function_id, label, score) values
  ('cx_requests_clarity',        'cx_requests', 'Process Clarity',             58),
  ('cx_requests_accuracy',       'cx_requests', 'Process Accuracy',            70),
  ('cx_requests_system',         'cx_requests', 'System Functionality',        62),
  ('cx_requests_accountability', 'cx_requests', 'Accountability & Visibility', 55),
  ('cx_requests_effectiveness',  'cx_requests', 'Overall Effectiveness',       65);
-- DOPS: Field Documentation
insert into public.signals (id, function_id, label, score) values
  ('field_docs_clarity',        'field_docs', 'Process Clarity',             40),
  ('field_docs_accuracy',       'field_docs', 'Process Accuracy',            45),
  ('field_docs_system',         'field_docs', 'System Functionality',        35),
  ('field_docs_accountability', 'field_docs', 'Accountability & Visibility', 30),
  ('field_docs_effectiveness',  'field_docs', 'Overall Effectiveness',       38);

-- VOC: Feedback Loop
insert into public.signals (id, function_id, label, score) values
  ('voc_loop_clarity',        'voc_loop', 'Process Clarity',             35),
  ('voc_loop_accuracy',       'voc_loop', 'Process Accuracy',            38),
  ('voc_loop_system',         'voc_loop', 'System Functionality',        28),
  ('voc_loop_accountability', 'voc_loop', 'Accountability & Visibility', 32),
  ('voc_loop_effectiveness',  'voc_loop', 'Overall Effectiveness',       30);
-- VOC: Bug Reporting
insert into public.signals (id, function_id, label, score) values
  ('bug_reporting_clarity',        'bug_reporting', 'Process Clarity',             48),
  ('bug_reporting_accuracy',       'bug_reporting', 'Process Accuracy',            52),
  ('bug_reporting_system',         'bug_reporting', 'System Functionality',        55),
  ('bug_reporting_accountability', 'bug_reporting', 'Accountability & Visibility', 42),
  ('bug_reporting_effectiveness',  'bug_reporting', 'Overall Effectiveness',       50);
-- VOC: Customer Zero Testing
insert into public.signals (id, function_id, label, score) values
  ('cust_zero_clarity',        'cust_zero', 'Process Clarity',             30),
  ('cust_zero_accuracy',       'cust_zero', 'Process Accuracy',            40),
  ('cust_zero_system',         'cust_zero', 'System Functionality',        38),
  ('cust_zero_accountability', 'cust_zero', 'Accountability & Visibility', 28),
  ('cust_zero_effectiveness',  'cust_zero', 'Overall Effectiveness',       35);

-- CS: Ticket Management
insert into public.signals (id, function_id, label, score) values
  ('ticket_mgmt_clarity',        'ticket_mgmt', 'Process Clarity',             65),
  ('ticket_mgmt_accuracy',       'ticket_mgmt', 'Process Accuracy',            60),
  ('ticket_mgmt_system',         'ticket_mgmt', 'System Functionality',        58),
  ('ticket_mgmt_accountability', 'ticket_mgmt', 'Accountability & Visibility', 60),
  ('ticket_mgmt_effectiveness',  'ticket_mgmt', 'Overall Effectiveness',       62);
-- CS: Technical Resolution
insert into public.signals (id, function_id, label, score) values
  ('tech_resolution_clarity',        'tech_resolution', 'Process Clarity',             70),
  ('tech_resolution_accuracy',       'tech_resolution', 'Process Accuracy',            74),
  ('tech_resolution_system',         'tech_resolution', 'System Functionality',        60),
  ('tech_resolution_accountability', 'tech_resolution', 'Accountability & Visibility', 65),
  ('tech_resolution_effectiveness',  'tech_resolution', 'Overall Effectiveness',       70);
-- CS: CSAT / NPS
insert into public.signals (id, function_id, label, score) values
  ('csat_nps_clarity',        'csat_nps', 'Process Clarity',             38),
  ('csat_nps_accuracy',       'csat_nps', 'Process Accuracy',            42),
  ('csat_nps_system',         'csat_nps', 'System Functionality',        50),
  ('csat_nps_accountability', 'csat_nps', 'Accountability & Visibility', 30),
  ('csat_nps_effectiveness',  'csat_nps', 'Overall Effectiveness',       38);

-- OPS: Training Content
insert into public.signals (id, function_id, label, score) values
  ('training_clarity',        'training', 'Process Clarity',             60),
  ('training_accuracy',       'training', 'Process Accuracy',            68),
  ('training_system',         'training', 'System Functionality',        55),
  ('training_accountability', 'training', 'Accountability & Visibility', 58),
  ('training_effectiveness',  'training', 'Overall Effectiveness',       63);
-- OPS: Knowledge Base
insert into public.signals (id, function_id, label, score) values
  ('knowledge_base_clarity',        'knowledge_base', 'Process Clarity',             55),
  ('knowledge_base_accuracy',       'knowledge_base', 'Process Accuracy',            58),
  ('knowledge_base_system',         'knowledge_base', 'System Functionality',        48),
  ('knowledge_base_accountability', 'knowledge_base', 'Accountability & Visibility', 50),
  ('knowledge_base_effectiveness',  'knowledge_base', 'Overall Effectiveness',       52);
-- OPS: Upward Reporting
insert into public.signals (id, function_id, label, score) values
  ('reporting_clarity',        'reporting', 'Process Clarity',             75),
  ('reporting_accuracy',       'reporting', 'Process Accuracy',            72),
  ('reporting_system',         'reporting', 'System Functionality',        70),
  ('reporting_accountability', 'reporting', 'Accountability & Visibility', 78),
  ('reporting_effectiveness',  'reporting', 'Overall Effectiveness',       73);

-- TEAM domain signals (per-member)
insert into public.signals (id, function_id, label, score, role) values
  -- Travel Load
  ('travel_t1',  'travel_load', 'FDE 1',  65, 'FDE'),
  ('travel_t2',  'travel_load', 'FDE 2',  65, 'FDE'),
  ('travel_t3',  'travel_load', 'FDE 3',  65, 'FDE'),
  ('travel_t4',  'travel_load', 'FDE 4',  65, 'FDE'),
  ('travel_t5',  'travel_load', 'FDE 5',  65, 'FDE'),
  ('travel_t6',  'travel_load', 'FDE 6',  65, 'FDE'),
  ('travel_t7',  'travel_load', 'FDE 7',  65, 'FDE'),
  ('travel_t8',  'travel_load', 'Mgr 1',  65, 'Manager'),
  ('travel_t9',  'travel_load', 'Mgr 2',  65, 'Manager'),
  ('travel_t10', 'travel_load', 'CS Pro', 65, 'CS'),
  -- Team Satisfaction
  ('team_sat_t1',  'team_sat', 'FDE 1',  72, 'FDE'),
  ('team_sat_t2',  'team_sat', 'FDE 2',  72, 'FDE'),
  ('team_sat_t3',  'team_sat', 'FDE 3',  72, 'FDE'),
  ('team_sat_t4',  'team_sat', 'FDE 4',  72, 'FDE'),
  ('team_sat_t5',  'team_sat', 'FDE 5',  72, 'FDE'),
  ('team_sat_t6',  'team_sat', 'FDE 6',  72, 'FDE'),
  ('team_sat_t7',  'team_sat', 'FDE 7',  72, 'FDE'),
  ('team_sat_t8',  'team_sat', 'Mgr 1',  72, 'Manager'),
  ('team_sat_t9',  'team_sat', 'Mgr 2',  72, 'Manager'),
  ('team_sat_t10', 'team_sat', 'CS Pro', 72, 'CS'),
  -- Company Satisfaction
  ('company_sat_t1',  'company_sat', 'FDE 1',  68, 'FDE'),
  ('company_sat_t2',  'company_sat', 'FDE 2',  68, 'FDE'),
  ('company_sat_t3',  'company_sat', 'FDE 3',  68, 'FDE'),
  ('company_sat_t4',  'company_sat', 'FDE 4',  68, 'FDE'),
  ('company_sat_t5',  'company_sat', 'FDE 5',  68, 'FDE'),
  ('company_sat_t6',  'company_sat', 'FDE 6',  68, 'FDE'),
  ('company_sat_t7',  'company_sat', 'FDE 7',  68, 'FDE'),
  ('company_sat_t8',  'company_sat', 'Mgr 1',  68, 'Manager'),
  ('company_sat_t9',  'company_sat', 'Mgr 2',  68, 'Manager'),
  ('company_sat_t10', 'company_sat', 'CS Pro', 68, 'CS');
