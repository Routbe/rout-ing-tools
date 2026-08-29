-- Spam- en misbruikrem op het aanmaken van korte links.
--
-- Deze SQL hoort in het externe Supabase-project (ejscdvocfxbphzgfbwui) te
-- worden uitgevoerd: de grenzen leven in de databank, zodat ze ook gelden
-- wanneer iemand de UI omzeilt en rechtstreeks tegen de Data API praat.
-- Privacyvriendelijk: we tellen enkel rijen van de eigenaar in een tijdvenster
-- — geen IP's, geen referers, geen user agents.
--
--   guest    -> kan niets aanmaken (user_id verplicht, RLS eist auth.uid())
--   member   -> 10 nieuwe links per uur, max 25 actieve links
--   verified -> 60 nieuwe links per uur, max 1000 actieve links
--
-- Klikken hebben hun eigen plafond in log_qr_scan (60 per code per minuut).

create or replace function public.enforce_short_link_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_verified boolean;
  per_hour int;
  max_total int;
  recent int;
  total int;
begin
  if new.user_id is null then
    raise exception 'RATE_LIMIT_SHORT_LINKS: short links need an owner';
  end if;

  select coalesce(p.verified, false) or coalesce(p.is_paid, false)
           or coalesce(p.is_early_believer, false)
    into is_verified
    from public.profiles p
   where p.id = new.user_id;

  if coalesce(is_verified, false) then
    per_hour := 60;
    max_total := 1000;
  else
    per_hour := 10;
    max_total := 25;
  end if;

  select count(*) into recent
    from public.tracked_qrs q
   where q.user_id = new.user_id
     and q.created_at > now() - interval '1 hour';

  if recent >= per_hour then
    raise exception 'RATE_LIMIT_SHORT_LINKS: too many new short links in the last hour';
  end if;

  select count(*) into total
    from public.tracked_qrs q
   where q.user_id = new.user_id;

  if total >= max_total then
    raise exception 'RATE_LIMIT_SHORT_LINKS: short link quota reached';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_short_link_limits() from public, anon;

drop trigger if exists trg_enforce_short_link_limits on public.tracked_qrs;
create trigger trg_enforce_short_link_limits
before insert on public.tracked_qrs
for each row execute function public.enforce_short_link_limits();
