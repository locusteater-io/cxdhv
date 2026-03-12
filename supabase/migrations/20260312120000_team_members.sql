-- Add active flag to signals (for team member inactive status)
alter table public.signals add column active boolean not null default true;

-- Update team member names across all functions
-- Managers
update public.signals set label = 'Eric Fujihara' where id in ('travel_t8', 'team_sat_t8', 'company_sat_t8');
update public.signals set label = 'Eric Reed' where id in ('travel_t9', 'team_sat_t9', 'company_sat_t9');
-- FDEs
update public.signals set label = 'Abi Lugo' where id in ('travel_t1', 'team_sat_t1', 'company_sat_t1');
update public.signals set label = 'Davron Zakhidov' where id in ('travel_t2', 'team_sat_t2', 'company_sat_t2');
update public.signals set label = 'Bryant Guerin' where id in ('travel_t3', 'team_sat_t3', 'company_sat_t3');
update public.signals set label = 'Kolton Kopple' where id in ('travel_t4', 'team_sat_t4', 'company_sat_t4');
update public.signals set label = 'Steven Rattigan' where id in ('travel_t5', 'team_sat_t5', 'company_sat_t5');
update public.signals set label = 'Tyler Byrd' where id in ('travel_t6', 'team_sat_t6', 'company_sat_t6');
update public.signals set label = 'Mek Saphakdy' where id in ('travel_t7', 'team_sat_t7', 'company_sat_t7');
update public.signals set label = 'Chris Lockie' where id in ('travel_t10', 'team_sat_t10', 'company_sat_t10');
-- Fix Chris Lockie's role — he's an FDE, not CS
update public.signals set role = 'FDE' where id in ('travel_t10', 'team_sat_t10', 'company_sat_t10');
-- CS Professional
-- We need a new set for Monique. Let's repurpose t10 slots were Chris Lockie (now FDE).
-- Add Monique as new signals
insert into public.signals (id, function_id, label, score, role, active) values
  ('travel_t11',      'travel_load',  'Monique Sanchez', 65, 'CS', true),
  ('team_sat_t11',    'team_sat',     'Monique Sanchez', 72, 'CS', true),
  ('company_sat_t11', 'company_sat',  'Monique Sanchez', 68, 'CS', true);
