revoke all on public.alias_sync_jobs from anon, authenticated;
revoke all on public.referral_visits from anon, authenticated;
revoke all on public.upload_rate_limits from anon, authenticated;
revoke all on public.webhook_events from anon, authenticated;
grant all on public.alias_sync_jobs to service_role;
grant all on public.referral_visits to service_role;
grant all on public.upload_rate_limits to service_role;
grant all on public.webhook_events to service_role;
grant select on public.alias_sync_jobs to authenticated;
grant select on public.webhook_events to authenticated;

create policy "Admins can read alias sync jobs" on public.alias_sync_jobs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can read webhook events" on public.webhook_events
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Service role manages referral visits" on public.referral_visits
  for all to service_role using (true) with check (true);
create policy "Service role manages upload rate limits" on public.upload_rate_limits
  for all to service_role using (true) with check (true);