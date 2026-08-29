drop view if exists public.public_profiles;

create or replace function public.get_public_profile(_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  tagline text,
  bio text,
  avatar_url text,
  favicon_url text,
  theme text,
  card_style text,
  blocks jsonb,
  business_info jsonb,
  tier text,
  status text,
  verified boolean,
  verified_at timestamptz,
  is_early_believer boolean,
  is_suspended boolean,
  is_banned boolean,
  subdomain_enabled boolean,
  custom_domain text,
  bluesky_did text,
  created_at timestamptz,
  show_email_publicly boolean,
  forwarding_email text
)
language sql
stable
security definer
set search_path = public
as $$
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