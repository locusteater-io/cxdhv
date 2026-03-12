-- Add weight column to signals
alter table public.signals add column weight numeric(4,2) not null default 0.20;

-- Set default weights based on signal label
update public.signals set weight = 0.15 where label = 'Process Clarity';
update public.signals set weight = 0.15 where label = 'Process Accuracy';
update public.signals set weight = 0.15 where label = 'System Functionality';
update public.signals set weight = 0.15 where label = 'Accountability & Visibility';
update public.signals set weight = 0.40 where label = 'Overall Effectiveness';
