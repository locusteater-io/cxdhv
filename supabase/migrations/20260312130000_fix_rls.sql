-- Fix RLS: allow anon writes for admin page (auth will be added later)
drop policy "Auth write domains" on public.domains;
drop policy "Auth write functions" on public.functions;
drop policy "Auth write signals" on public.signals;
drop policy "Auth write survey" on public.survey_responses;

create policy "Public write domains" on public.domains for all using (true) with check (true);
create policy "Public write functions" on public.functions for all using (true) with check (true);
create policy "Public write signals" on public.signals for all using (true) with check (true);
create policy "Public write survey" on public.survey_responses for all using (true) with check (true);
