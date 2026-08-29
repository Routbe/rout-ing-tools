-- Zorgt dat hallo@rout.be (of het oudste account, indien dat adres nog niet
-- bestaat) meteen de rol `admin` heeft, zodat de "setupmodus"-banner nooit
-- onterecht blijft staan op een omgeving die al gebruikers heeft.
--
-- Idempotent: mag zonder gevolgen herhaald worden bij elke deploy.
--
-- De runtime-tegenhanger staat in src/lib/auth/owner-admin.server.ts
-- (ensureOwnerAdmin / ensureBootstrapAdmin), die dit ook afdwingt bij elke
-- registratie en login. Deze migratie dekt bestaande omgevingen waar dat
-- pad nog niet is doorlopen.

do $$
declare
  owner_id uuid;
  fallback_id uuid;
begin
  if to_regclass('public.users') is null or to_regclass('public.user_roles') is null then
    return;
  end if;

  -- 1. hallo@rout.be krijgt altijd de rol, als het account bestaat.
  select id into owner_id
    from public.users
   where lower(email) = 'hallo@rout.be'
   order by created_at asc
   limit 1;

  if owner_id is not null then
    insert into public.user_roles (user_id, role)
    values (owner_id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;

  -- 2. Bestaat er nog geen enkele beheerder, dan krijgt het oudste account
  --    de rol (dekt omgevingen waar hallo@rout.be nog niet is aangemaakt).
  if not exists (select 1 from public.user_roles where role::text = 'admin') then
    select id into fallback_id
      from public.users
     order by created_at asc
     limit 1;

    if fallback_id is not null then
      insert into public.user_roles (user_id, role)
      values (fallback_id, 'admin')
      on conflict (user_id, role) do nothing;
    end if;
  end if;
end
$$;

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
