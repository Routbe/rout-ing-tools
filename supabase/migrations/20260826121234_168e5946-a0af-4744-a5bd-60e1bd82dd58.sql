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

create or replace view public.public_profiles as
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
  case when show_email_publicly then forwarding_email else null end as forwarding_email
from public.profiles
where username is not null;

grant select on public.public_profiles to anon, authenticated;
grant all on public.public_profiles to service_role;

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

create policy "service role manages alias sync jobs" on public.alias_sync_jobs
  for all to service_role using (true) with check (true);
create policy "service role manages upload rate limits" on public.upload_rate_limits
  for all to service_role using (true) with check (true);
create policy "service role manages webhook events" on public.webhook_events
  for all to service_role using (true) with check (true);