create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin','moderator','user');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key,
  username text unique,
  display_name text,
  tagline text,
  bio text,
  avatar_url text,
  favicon_url text,
  theme text not null default 'paper',
  card_style text not null default 'classic',
  blocks jsonb not null default '[]'::jsonb,
  business_info jsonb not null default '{}'::jsonb,
  tier text not null default 'free',
  status text not null default 'active',
  verified boolean not null default false,
  verified_at timestamptz,
  verified_legal_name text,
  is_early_believer boolean not null default false,
  is_paid boolean not null default false,
  is_suspended boolean not null default false,
  is_banned boolean not null default false,
  subdomain_enabled boolean not null default false,
  custom_domain text,
  bluesky_did text,
  redirect_target text not null default 'hub',
  show_email_publicly boolean not null default false,
  forwarding_email text,
  forwarding_email_token text,
  forwarding_email_token_expires_at timestamptz,
  forwarding_email_verified boolean not null default false,
  handle_grant text,
  payment_method text,
  moderated_at timestamptz,
  moderated_by uuid,
  moderation_reason text,
  alias_status text not null default 'none',
  alias_sync_status text not null default 'idle',
  alias_sync_attempts integer not null default 0,
  alias_sync_error text,
  alias_synced_at timestamptz,
  referred_by uuid,
  referral_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  url text not null,
  icon text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.links to authenticated;
grant select on public.links to anon;
grant all on public.links to service_role;
alter table public.links enable row level security;
create policy "public links read" on public.links for select to anon, authenticated using (true);
create policy "own links write" on public.links for all to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  device_type text,
  referrer text,
  created_at timestamptz not null default now()
);
grant insert on public.analytics_events to anon, authenticated;
grant select on public.analytics_events to authenticated;
grant all on public.analytics_events to service_role;
alter table public.analytics_events enable row level security;
create policy "anyone can log events" on public.analytics_events for insert to anon, authenticated with check (true);
create policy "own events read" on public.analytics_events for select to authenticated using (auth.uid() = profile_id);

create table if not exists public.tracked_qrs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  slug text not null unique,
  dashboard_token text not null unique,
  kind text not null default 'qr',
  label text,
  target_type text not null,
  target_url text not null,
  custom_domain text,
  short_link_enabled boolean not null default false,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tracked_qrs to authenticated;
grant insert on public.tracked_qrs to anon;
grant all on public.tracked_qrs to service_role;
alter table public.tracked_qrs enable row level security;
create policy "own qrs" on public.tracked_qrs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id or user_id is null);
create policy "anon can create qrs" on public.tracked_qrs for insert to anon with check (user_id is null);

create table if not exists public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  tracked_qr_id uuid not null references public.tracked_qrs(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  country text,
  device text,
  user_agent text
);
grant select on public.qr_scans to authenticated;
grant all on public.qr_scans to service_role;
alter table public.qr_scans enable row level security;
create policy "own scans read" on public.qr_scans for select to authenticated using (
  exists (select 1 from public.tracked_qrs q where q.id = tracked_qr_id and q.user_id = auth.uid())
);

create table if not exists public.saved_qrs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  qr_type text not null,
  qr_value text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.saved_qrs to authenticated;
grant all on public.saved_qrs to service_role;
alter table public.saved_qrs enable row level security;
create policy "own saved qrs" on public.saved_qrs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  icon text not null default 'award',
  color text not null default 'slate',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.badges to anon, authenticated;
grant all on public.badges to service_role;
alter table public.badges enable row level security;
create policy "badges are public" on public.badges for select to anon, authenticated using (true);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_by uuid,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);
grant select on public.user_badges to anon, authenticated;
grant all on public.user_badges to service_role;
alter table public.user_badges enable row level security;
create policy "user badges readable" on public.user_badges for select to anon, authenticated using (true);

create table if not exists public.badge_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  badge_slug text not null,
  action text not null default 'granted',
  source text not null default 'system',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.badge_events to authenticated;
grant all on public.badge_events to service_role;
alter table public.badge_events enable row level security;
create policy "own badge events" on public.badge_events for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  admin_email text,
  action text not null,
  target_user_id uuid,
  target_label text,
  notes text,
  created_at timestamptz not null default now()
);
grant select on public.admin_audit_log to authenticated;
grant all on public.admin_audit_log to service_role;
alter table public.admin_audit_log enable row level security;
create policy "admins read audit" on public.admin_audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));

create table if not exists public.alias_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.alias_sync_jobs to service_role;
alter table public.alias_sync_jobs enable row level security;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  scopes text[] not null default '{}',
  rate_limit integer not null default 1000,
  request_count integer not null default 0,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.api_keys to authenticated;
grant all on public.api_keys to service_role;
alter table public.api_keys enable row level security;
create policy "own api keys" on public.api_keys for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  domain text not null unique,
  status text not null default 'pending',
  verification_token text not null,
  verified_at timestamptz,
  last_checked_at timestamptz,
  is_default boolean not null default false,
  short_links_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.custom_domains to authenticated;
grant all on public.custom_domains to service_role;
alter table public.custom_domains enable row level security;
create policy "own domains" on public.custom_domains for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.reserved_handles (
  handle text primary key,
  reason text not null default 'reserved',
  label text,
  created_at timestamptz not null default now()
);
grant select on public.reserved_handles to anon, authenticated;
grant all on public.reserved_handles to service_role;
alter table public.reserved_handles enable row level security;
create policy "reserved handles readable" on public.reserved_handles for select to anon, authenticated using (true);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  kind text not null,
  message text not null,
  severity text not null default 'info',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.security_events to authenticated;
grant all on public.security_events to service_role;
alter table public.security_events enable row level security;
create policy "own security events" on public.security_events for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create table if not exists public.showcase_profiles (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  display_name text not null,
  tagline text not null default '',
  bio text not null default '',
  avatar_url text,
  theme text not null default 'paper',
  link_count integer not null default 0,
  verified boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.showcase_profiles to anon, authenticated;
grant all on public.showcase_profiles to service_role;
alter table public.showcase_profiles enable row level security;
create policy "showcase public" on public.showcase_profiles for select to anon, authenticated using (true);

create table if not exists public.upload_rate_limits (
  client_ip text primary key,
  upload_count integer not null default 0,
  window_start timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.upload_rate_limits to service_role;
alter table public.upload_rate_limits enable row level security;

create table if not exists public.verification_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tier text not null,
  amount_cents integer not null,
  currency text not null default 'EUR',
  donation_cents integer not null default 0,
  donation_plan text not null default 'none',
  provider text not null default 'manual',
  provider_ref text,
  reference_code text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert on public.verification_payments to authenticated;
grant all on public.verification_payments to service_role;
alter table public.verification_payments enable row level security;
create policy "own payments" on public.verification_payments for select to authenticated using (auth.uid() = user_id);
create policy "own payments insert" on public.verification_payments for insert to authenticated with check (auth.uid() = user_id);

create table if not exists public.webhook_events (
  id text primary key,
  source text not null,
  kind text,
  created_at timestamptz not null default now()
);
grant all on public.webhook_events to service_role;
alter table public.webhook_events enable row level security;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  title text not null,
  body text not null default '',
  locale text not null default 'en',
  severity text not null default 'info',
  details jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "own notifications update" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- functions

create or replace function public.get_my_profile()
returns public.profiles
language sql stable security definer set search_path = public as $$
  select p.* from public.profiles p where p.id = auth.uid() limit 1;
$$;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated, service_role;

create or replace function public.get_public_profile(_username text)
returns table (
  id uuid, username text, display_name text, tagline text, bio text,
  avatar_url text, favicon_url text, theme text, card_style text, blocks jsonb,
  business_info jsonb, tier text, status text, verified boolean, verified_at timestamptz,
  is_early_believer boolean, is_suspended boolean, is_banned boolean,
  subdomain_enabled boolean, custom_domain text, bluesky_did text, created_at timestamptz,
  show_email_publicly boolean, forwarding_email text
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.username, p.display_name, p.tagline, p.bio, p.avatar_url, p.favicon_url,
    p.theme, p.card_style, p.blocks, p.business_info, p.tier, p.status, p.verified,
    p.verified_at, p.is_early_believer, p.is_suspended, p.is_banned,
    p.subdomain_enabled, p.custom_domain, p.bluesky_did, p.created_at,
    p.show_email_publicly,
    case when p.show_email_publicly then p.forwarding_email else null end
  from public.profiles p
  where p.username = lower(_username)
  limit 1;
$$;
revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated, service_role;

create or replace function public.is_handle_available(_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select lower(_username) ~ '^[a-z0-9](?:[a-z0-9._-]{0,30}[a-z0-9])?$'
    and not exists (select 1 from public.profiles p where p.username = lower(_username))
    and not exists (select 1 from public.reserved_handles r where r.handle = lower(_username));
$$;
revoke all on function public.is_handle_available(text) from public;
grant execute on function public.is_handle_available(text) to anon, authenticated, service_role;

create or replace function public.generate_unique_handle(_seed text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  base text;
  candidate text;
  i int := 0;
begin
  base := regexp_replace(lower(coalesce(_seed, 'member')), '[^a-z0-9]+', '', 'g');
  if length(base) < 3 then base := base || 'member'; end if;
  base := left(base, 20);
  candidate := base;
  while not public.is_handle_available(candidate) loop
    i := i + 1;
    candidate := left(base, 20) || i::text;
    exit when i > 9999;
  end loop;
  return candidate;
end;
$$;
revoke all on function public.generate_unique_handle(text) from public, anon;
grant execute on function public.generate_unique_handle(text) to authenticated, service_role;

create or replace function public.grant_signup_badges(_user_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  insert into public.user_badges (user_id, badge_id)
  select _user_id, b.id from public.badges b where b.slug in ('early-believer','member')
  on conflict (user_id, badge_id) do nothing;
end;
$$;
revoke all on function public.grant_signup_badges(uuid) from public, anon;
grant execute on function public.grant_signup_badges(uuid) to authenticated, service_role;

create or replace function public.resolve_short_link(_slug text)
returns table (id uuid, status text, target_url text)
language sql stable security definer set search_path = public as $$
  select q.id,
    case
      when not q.is_active then 'disabled'
      when q.expires_at is not null and q.expires_at < now() then 'expired'
      else 'ok'
    end as status,
    q.target_url
  from public.tracked_qrs q
  where q.slug = lower(_slug)
  limit 1;
$$;
revoke all on function public.resolve_short_link(text) from public;
grant execute on function public.resolve_short_link(text) to anon, authenticated, service_role;

create or replace function public.manage_short_link(
  _token text,
  _action text,
  _target_url text default null,
  _is_active boolean default null,
  _expires_at timestamptz default null,
  _slug text default null
) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  row public.tracked_qrs;
begin
  select * into row from public.tracked_qrs where dashboard_token = _token limit 1;
  if row.id is null then
    raise exception 'Dashboard not found';
  end if;

  if _action = 'update_target' then
    if _target_url is null or length(_target_url) < 3 then
      raise exception 'Invalid target url';
    end if;
    update public.tracked_qrs set target_url = _target_url, updated_at = now() where id = row.id;
  elsif _action = 'set_active' then
    update public.tracked_qrs set is_active = coalesce(_is_active, true), updated_at = now() where id = row.id;
  elsif _action = 'set_expiry' then
    update public.tracked_qrs set expires_at = _expires_at, updated_at = now() where id = row.id;
  elsif _action = 'regenerate_slug' then
    if _slug is null then raise exception 'Missing slug'; end if;
    update public.tracked_qrs set slug = lower(_slug), updated_at = now() where id = row.id;
  elsif _action = 'delete' then
    delete from public.tracked_qrs where id = row.id;
  else
    raise exception 'Unknown action %', _action;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.manage_short_link(text, text, text, boolean, timestamptz, text) from public;
grant execute on function public.manage_short_link(text, text, text, boolean, timestamptz, text) to anon, authenticated, service_role;

create or replace function public.claim_referral(p_referrer text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  inviter uuid;
begin
  if auth.uid() is null then return; end if;
  select id into inviter from public.profiles where username = lower(p_referrer) limit 1;
  if inviter is null or inviter = auth.uid() then return; end if;
  update public.profiles set referred_by = inviter, updated_at = now()
    where id = auth.uid() and referred_by is null;
  if found then
    update public.profiles set referral_count = referral_count + 1 where id = inviter;
  end if;
end;
$$;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated, service_role;

create or replace function public.delete_account()
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  delete from public.saved_qrs where user_id = uid;
  delete from public.tracked_qrs where user_id = uid;
  delete from public.api_keys where user_id = uid;
  delete from public.custom_domains where user_id = uid;
  delete from public.notifications where user_id = uid;
  delete from public.user_badges where user_id = uid;
  delete from public.profiles where id = uid;
end;
$$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated, service_role;

create or replace function public.seed_demo_content(_user_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  insert into public.links (profile_id, title, url, position)
  select _user_id, 'My website', 'https://example.com', 0
  where exists (select 1 from public.profiles where id = _user_id)
    and not exists (select 1 from public.links where profile_id = _user_id);
end;
$$;
revoke all on function public.seed_demo_content(uuid) from public, anon;
grant execute on function public.seed_demo_content(uuid) to authenticated, service_role;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.badges (slug, name, description, icon, color, sort_order) values
  ('member', 'Member', 'Joined the community', 'user', 'slate', 10),
  ('early-believer', 'Early believer', 'Was here from the start', 'sparkles', 'amber', 20)
on conflict (slug) do nothing;

-- qr scan columns + logging

alter table public.qr_scans drop column if exists user_agent;
alter table public.qr_scans add column if not exists browser text;
alter table public.qr_scans add column if not exists os text;

create or replace function public.short_link_stats(_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when q.id is null then null else jsonb_build_object(
    'qr', to_jsonb(q),
    'scans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scanned_at', s.scanned_at, 'country', s.country,
        'device', s.device, 'browser', s.browser, 'os', s.os
      ) order by s.scanned_at desc)
      from public.qr_scans s where s.tracked_qr_id = q.id
    ), '[]'::jsonb)
  ) end
  from public.tracked_qrs q
  where q.dashboard_token = _token
  limit 1;
$$;
revoke all on function public.short_link_stats(text) from public;
grant execute on function public.short_link_stats(text) to anon, authenticated, service_role;

-- internal tables locked to service role

revoke all on public.alias_sync_jobs from anon, authenticated;
revoke all on public.upload_rate_limits from anon, authenticated;
revoke all on public.webhook_events from anon, authenticated;
grant all on public.alias_sync_jobs to service_role;
grant all on public.upload_rate_limits to service_role;
grant all on public.webhook_events to service_role;
grant select on public.alias_sync_jobs to authenticated;
grant select on public.webhook_events to authenticated;

create policy "Admins can read alias sync jobs" on public.alias_sync_jobs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can read webhook events" on public.webhook_events
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Service role manages upload rate limits" on public.upload_rate_limits
  for all to service_role using (true) with check (true);

-- profile read hardening

drop policy if exists "Profiles are publicly viewable" on public.profiles;
drop policy if exists "Users view own profile" on public.profiles;
drop policy if exists "Admins view all profiles" on public.profiles;

create policy "Users view own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Admins view all profiles"
on public.profiles for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

revoke select on public.profiles from anon;

-- sign-in brute force protection

create table if not exists public.signin_throttle (
  identity_hash text primary key,
  failures int not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

grant all on public.signin_throttle to service_role;
alter table public.signin_throttle enable row level security;

create or replace function public.signin_guard_status(_identity_hash text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.signin_throttle;
begin
  select * into r from public.signin_throttle where identity_hash = _identity_hash;
  if r.identity_hash is null or r.locked_until is null or r.locked_until <= now() then
    return jsonb_build_object('locked', false, 'retry_after', 0);
  end if;
  return jsonb_build_object('locked', true,
    'retry_after', greatest(1, ceil(extract(epoch from (r.locked_until - now())))::int));
end;
$$;

create or replace function public.signin_guard_record(_identity_hash text, _success boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r public.signin_throttle; new_failures int; lock_for interval;
begin
  if _identity_hash is null or length(_identity_hash) not between 16 and 128 then
    return jsonb_build_object('locked', false, 'retry_after', 0);
  end if;

  if _success then
    delete from public.signin_throttle where identity_hash = _identity_hash;
    return jsonb_build_object('locked', false, 'retry_after', 0);
  end if;

  select * into r from public.signin_throttle where identity_hash = _identity_hash for update;

  if r.identity_hash is null or r.window_started_at < now() - interval '15 minutes' then
    insert into public.signin_throttle (identity_hash, failures, window_started_at, locked_until)
    values (_identity_hash, 1, now(), null)
    on conflict (identity_hash) do update
      set failures = 1, window_started_at = now(), locked_until = null;
    return jsonb_build_object('locked', false, 'retry_after', 0);
  end if;

  new_failures := r.failures + 1;
  lock_for := case
    when new_failures >= 10 then interval '15 minutes'
    when new_failures >= 7 then interval '5 minutes'
    when new_failures >= 5 then interval '1 minute'
    else null end;

  update public.signin_throttle
     set failures = new_failures,
         locked_until = case when lock_for is null then null else now() + lock_for end
   where identity_hash = _identity_hash;

  delete from public.signin_throttle
   where window_started_at < now() - interval '1 day'
     and (locked_until is null or locked_until < now());

  if lock_for is null then
    return jsonb_build_object('locked', false, 'retry_after', 0);
  end if;
  return jsonb_build_object('locked', true,
    'retry_after', ceil(extract(epoch from lock_for))::int);
end;
$$;

revoke all on function public.signin_guard_status(text) from public;
revoke all on function public.signin_guard_record(text, boolean) from public;
grant execute on function public.signin_guard_status(text) to anon, authenticated, service_role;
grant execute on function public.signin_guard_record(text, boolean) to anon, authenticated, service_role;

create or replace function public.log_qr_scan(
  _tracked_qr_id uuid,
  _device text default null,
  _country text default null,
  _browser text default null,
  _os text default null
) returns void language plpgsql volatile security definer set search_path = public as $$
declare recent int;
begin
  if _tracked_qr_id is null then return; end if;

  select count(*) into recent
    from public.qr_scans
   where tracked_qr_id = _tracked_qr_id
     and scanned_at > now() - interval '1 minute';

  if recent >= 60 then return; end if;

  insert into public.qr_scans (tracked_qr_id, device, country, browser, os)
  values (_tracked_qr_id, left(_device, 20), left(_country, 2), left(_browser, 20), left(_os, 20));
end;
$$;
revoke all on function public.log_qr_scan(uuid, text, text, text, text) from public;
grant execute on function public.log_qr_scan(uuid, text, text, text, text) to anon, authenticated, service_role;

-- email aliases

create table if not exists public.email_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  domain text not null check (domain in ('rout.be', 'dlp.li')),
  forward_to text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'failed', 'paused')),
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (handle, domain),
  unique (user_id, domain)
);

create index if not exists email_aliases_user_id_idx on public.email_aliases (user_id);

grant select, insert, update, delete on public.email_aliases to authenticated;
grant all on public.email_aliases to service_role;

alter table public.email_aliases enable row level security;

drop policy if exists "Members read their own aliases" on public.email_aliases;
create policy "Members read their own aliases" on public.email_aliases
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Members create their own aliases" on public.email_aliases;
create policy "Members create their own aliases" on public.email_aliases
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members update their own aliases" on public.email_aliases;
create policy "Members update their own aliases" on public.email_aliases
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members delete their own aliases" on public.email_aliases;
create policy "Members delete their own aliases" on public.email_aliases
  for delete to authenticated
  using (auth.uid() = user_id);

-- url style + preferred language

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS url_style text NOT NULL DEFAULT 'u_at';

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_url_style_check
    CHECK (url_style IN ('u', 'u_at', 'clean', 'clean_at'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_preferred_language_check CHECK (preferred_language IS NULL OR preferred_language IN ('nl','en','fr','de'));