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
  forwarding_email,
  url_style
) on public.profiles to anon;

drop policy if exists "public profile rows are readable" on public.profiles;
create policy "public profile rows are readable" on public.profiles
  for select to anon
  using (username is not null and is_banned = false);