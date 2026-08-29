-- 1. Brute-force protection for sign-in, keyed on a client-computed SHA-256
--    hash of the e-mail. No e-mail, IP or user agent is ever stored.
create table if not exists public.signin_throttle (
  identity_hash text primary key,
  failures int not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

grant all on public.signin_throttle to service_role;
alter table public.signin_throttle enable row level security;
-- No policies: only security-definer functions below may touch it.

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

  -- Opportunistic cleanup of stale rows.
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

-- 2. QR scan logging: cap the number of scans recorded per code per minute so
--    a script cannot flood the counter. Still no IP / user-agent storage.
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

  -- Hard ceiling per code per minute; excess scans are silently dropped.
  if recent >= 60 then return; end if;

  insert into public.qr_scans (tracked_qr_id, device, country, browser, os)
  values (_tracked_qr_id, left(_device, 20), left(_country, 2), left(_browser, 20), left(_os, 20));
end;
$$;
revoke all on function public.log_qr_scan(uuid, text, text, text, text) from public;
grant execute on function public.log_qr_scan(uuid, text, text, text, text) to anon, authenticated, service_role;