-- 1. Limited public view for public profile pages
create or replace view public.public_profiles
with (security_invoker = false) as
select
  p.id,
  p.username,
  p.display_name,
  p.tagline,
  p.bio,
  p.avatar_url,
  p.favicon_url,
  p.theme,
  p.card_style,
  p.blocks,
  p.business_info,
  p.tier,
  p.status,
  p.verified,
  p.verified_at,
  p.is_early_believer,
  p.is_suspended,
  p.is_banned,
  p.subdomain_enabled,
  p.custom_domain,
  p.bluesky_did,
  p.created_at,
  p.show_email_publicly,
  case when p.show_email_publicly then p.forwarding_email else null end as forwarding_email
from public.profiles p;

grant select on public.public_profiles to anon, authenticated;
grant select on public.public_profiles to service_role;

-- 2. Lock down direct table reads
drop policy if exists "Profiles are publicly viewable" on public.profiles;

create policy "Users view own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Admins view all profiles"
on public.profiles for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

revoke select on public.profiles from anon;

-- 3. Handle availability check without exposing other members' rows
create or replace function public.is_handle_available(_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where username = lower(_username)
      and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

revoke all on function public.is_handle_available(text) from public;
grant execute on function public.is_handle_available(text) to authenticated;