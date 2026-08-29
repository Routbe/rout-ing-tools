revoke select (forwarding_email) on public.profiles from anon;

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