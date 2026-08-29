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

create table if not exists public.referral_visits (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  inviter_id uuid,
  created_at timestamptz not null default now()
);
grant all on public.referral_visits to service_role;
alter table public.referral_visits enable row level security;