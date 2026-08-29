create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
drop trigger if exists links_touch_updated_at on public.links;
create trigger links_touch_updated_at before update on public.links
for each row execute function public.touch_updated_at();
drop trigger if exists tracked_qrs_touch_updated_at on public.tracked_qrs;
create trigger tracked_qrs_touch_updated_at before update on public.tracked_qrs
for each row execute function public.touch_updated_at();
drop trigger if exists saved_qrs_touch_updated_at on public.saved_qrs;
create trigger saved_qrs_touch_updated_at before update on public.saved_qrs
for each row execute function public.touch_updated_at();
drop trigger if exists alias_sync_jobs_touch_updated_at on public.alias_sync_jobs;
create trigger alias_sync_jobs_touch_updated_at before update on public.alias_sync_jobs
for each row execute function public.touch_updated_at();
drop trigger if exists api_keys_touch_updated_at on public.api_keys;
create trigger api_keys_touch_updated_at before update on public.api_keys
for each row execute function public.touch_updated_at();
drop trigger if exists custom_domains_touch_updated_at on public.custom_domains;
create trigger custom_domains_touch_updated_at before update on public.custom_domains
for each row execute function public.touch_updated_at();
drop trigger if exists upload_rate_limits_touch_updated_at on public.upload_rate_limits;
create trigger upload_rate_limits_touch_updated_at before update on public.upload_rate_limits
for each row execute function public.touch_updated_at();
drop trigger if exists verification_payments_touch_updated_at on public.verification_payments;
create trigger verification_payments_touch_updated_at before update on public.verification_payments
for each row execute function public.touch_updated_at();

alter table public.profiles add column if not exists email text;
create index if not exists profiles_email_idx on public.profiles (lower(email)) where email is not null;

insert into public.profiles (id, email, display_name)
select
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
from auth.users u
on conflict (id) do update
set
  email = coalesce(public.profiles.email, excluded.email),
  display_name = coalesce(public.profiles.display_name, excluded.display_name),
  updated_at = now();

insert into public.user_roles (user_id, role)
select u.id, 'user'::public.app_role
from auth.users u
on conflict (user_id, role) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.profiles.email),
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    updated_at = now();

  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

create or replace view public.profile_handles as
select username
from public.profiles
where username is not null;

grant select on public.profile_handles to anon, authenticated;
grant all on public.profile_handles to service_role;

create or replace function public.get_my_account()
returns table (
  id uuid,
  email text,
  username text,
  display_name text,
  avatar_url text,
  tier text,
  status text,
  verified boolean,
  verified_at timestamptz,
  is_early_believer boolean,
  is_paid boolean,
  show_email_publicly boolean,
  forwarding_email text,
  forwarding_email_verified boolean,
  bluesky_did text,
  roles public.app_role[]
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.email,
    p.username,
    p.display_name,
    p.avatar_url,
    p.tier,
    p.status,
    p.verified,
    p.verified_at,
    p.is_early_believer,
    p.is_paid,
    p.show_email_publicly,
    p.forwarding_email,
    p.forwarding_email_verified,
    p.bluesky_did,
    coalesce(array_agg(ur.role order by ur.role) filter (where ur.role is not null), '{}'::public.app_role[]) as roles
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  where p.id = auth.uid()
  group by p.id;
$$;
revoke all on function public.get_my_account() from public, anon;
grant execute on function public.get_my_account() to authenticated, service_role;

create or replace function public.get_my_profile()
returns public.profiles
language sql
stable
security invoker
set search_path = public
as $$
  select p.* from public.profiles p where p.id = auth.uid() limit 1;
$$;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated, service_role;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select _user_id = auth.uid()
    and exists (
      select 1
      from public.user_roles
      where user_id = _user_id
        and role = _role
    )
$$;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

revoke all on function public.get_public_profile(text) from public, anon, authenticated;
grant execute on function public.get_public_profile(text) to service_role;
revoke all on function public.is_handle_available(text) from public, anon, authenticated;
grant execute on function public.is_handle_available(text) to service_role;
revoke all on function public.generate_unique_handle(text) from public, anon, authenticated;
grant execute on function public.generate_unique_handle(text) to service_role;

drop policy if exists "service role manages alias sync jobs" on public.alias_sync_jobs;
create policy "service role manages alias sync jobs" on public.alias_sync_jobs
  for all to service_role using (true) with check (true);
drop policy if exists "service role manages upload rate limits" on public.upload_rate_limits;
create policy "service role manages upload rate limits" on public.upload_rate_limits
  for all to service_role using (true) with check (true);
drop policy if exists "service role manages webhook events" on public.webhook_events;
create policy "service role manages webhook events" on public.webhook_events
  for all to service_role using (true) with check (true);

grant select (
  id,
  username,
  display_name,
  tagline,
  bio,
  avatar_url,
  favicon_url,
  theme,
  card_style,
  blocks,
  business_info,
  tier,
  status,
  verified,
  verified_at,
  is_early_believer,
  is_suspended,
  is_banned,
  subdomain_enabled,
  custom_domain,
  bluesky_did,
  created_at,
  show_email_publicly,
  url_style
) on public.profiles to anon;

drop policy if exists "public profile rows are readable" on public.profiles;
create policy "public profile rows are readable" on public.profiles
  for select to anon
  using (username is not null and is_banned = false);

create or replace view public.public_profiles with (security_invoker = true) as
select
  id,
  username,
  display_name,
  tagline,
  bio,
  avatar_url,
  favicon_url,
  theme,
  card_style,
  blocks,
  business_info,
  tier,
  status,
  verified,
  verified_at,
  is_early_believer,
  is_suspended,
  is_banned,
  subdomain_enabled,
  custom_domain,
  bluesky_did,
  created_at,
  show_email_publicly,
  null::text as forwarding_email
from public.profiles
where username is not null;

grant select on public.public_profiles to anon, authenticated;
grant all on public.public_profiles to service_role;

alter view public.profile_handles set (security_invoker = true);

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'pending',
  error_detail text,
  sender_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.contact_submissions TO service_role;
GRANT SELECT ON public.contact_submissions TO authenticated;

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can read contact submissions"
  ON public.contact_submissions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS contact_submissions_created_at_idx ON public.contact_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS contact_submissions_sender_hash_idx ON public.contact_submissions (sender_hash, created_at DESC);

DROP TRIGGER IF EXISTS contact_submissions_touch_updated_at ON public.contact_submissions;
CREATE TRIGGER contact_submissions_touch_updated_at
  BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.contact_submissions_recent_count(_sender_hash text, _window_minutes int DEFAULT 10)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select count(*)::int
  from public.contact_submissions
  where _sender_hash is not null
    and sender_hash = _sender_hash
    and created_at > now() - make_interval(mins => greatest(_window_minutes, 1))
$$;

REVOKE ALL ON FUNCTION public.contact_submissions_recent_count(text, int) FROM public;
REVOKE ALL ON FUNCTION public.contact_submissions_recent_count(text, int) FROM anon;
REVOKE ALL ON FUNCTION public.contact_submissions_recent_count(text, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.contact_submissions_recent_count(text, int) TO service_role;

drop policy if exists "avatars read" on storage.objects;
create policy "avatars read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars insert own folder" on storage.objects;
create policy "avatars insert own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars update own folder" on storage.objects;
create policy "avatars update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars delete own folder" on storage.objects;
create policy "avatars delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "qr files read own folder" on storage.objects;
create policy "qr files read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "qr files insert own folder" on storage.objects;
create policy "qr files insert own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "qr files update own folder" on storage.objects;
create policy "qr files update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "qr files delete own folder" on storage.objects;
create policy "qr files delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'qr-files' and (storage.foldername(name))[1] = auth.uid()::text);