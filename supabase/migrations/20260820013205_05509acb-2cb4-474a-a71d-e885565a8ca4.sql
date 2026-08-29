alter table public.qr_scans drop column if exists user_agent;
alter table public.qr_scans add column if not exists browser text;
alter table public.qr_scans add column if not exists os text;

drop function if exists public.log_qr_scan(uuid, text, text, text);

create or replace function public.log_qr_scan(
  _tracked_qr_id uuid,
  _device text default null,
  _country text default null,
  _browser text default null,
  _os text default null
) returns void language plpgsql volatile security definer set search_path = public as $$
begin
  insert into public.qr_scans (tracked_qr_id, device, country, browser, os)
  values (_tracked_qr_id, left(_device, 20), left(_country, 2), left(_browser, 20), left(_os, 20));
end;
$$;
revoke all on function public.log_qr_scan(uuid, text, text, text, text) from public;
grant execute on function public.log_qr_scan(uuid, text, text, text, text) to anon, authenticated, service_role;

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