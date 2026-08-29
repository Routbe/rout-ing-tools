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

create or replace function public.log_qr_scan(
  _tracked_qr_id uuid, _device text default null, _country text default null, _user_agent text default null
) returns void language plpgsql volatile security definer set search_path = public as $$
begin
  insert into public.qr_scans (tracked_qr_id, device, country, user_agent)
  values (_tracked_qr_id, _device, _country, left(coalesce(_user_agent,''), 500));
end;
$$;
revoke all on function public.log_qr_scan(uuid, text, text, text) from public;
grant execute on function public.log_qr_scan(uuid, text, text, text) to anon, authenticated, service_role;

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

create or replace function public.short_link_stats(_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when q.id is null then null else jsonb_build_object(
    'qr', to_jsonb(q),
    'scans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scanned_at', s.scanned_at, 'country', s.country,
        'device', s.device, 'user_agent', s.user_agent
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