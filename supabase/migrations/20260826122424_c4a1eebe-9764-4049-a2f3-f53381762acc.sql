DROP FUNCTION IF EXISTS public.contact_submissions_recent_count(text, int);

DROP INDEX IF EXISTS public.contact_submissions_ip_created_idx;

ALTER TABLE public.contact_submissions
  DROP COLUMN IF EXISTS user_agent,
  DROP COLUMN IF EXISTS referer;

ALTER TABLE public.contact_submissions
  RENAME COLUMN ip_address TO sender_hash;

CREATE INDEX contact_submissions_sender_hash_idx
  ON public.contact_submissions (sender_hash, created_at DESC);

CREATE OR REPLACE FUNCTION public.contact_submissions_recent_count(_sender_hash text, _window_minutes int DEFAULT 10)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select count(*)::int
  from public.contact_submissions
  where _sender_hash is not null
    and sender_hash = _sender_hash
    and created_at > now() - make_interval(mins => greatest(_window_minutes, 1))
$$;

REVOKE ALL ON FUNCTION public.contact_submissions_recent_count(text, int) FROM public;
REVOKE ALL ON FUNCTION public.contact_submissions_recent_count(text, int) FROM anon;
REVOKE ALL ON FUNCTION public.contact_submissions_recent_count(text, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.contact_submissions_recent_count(text, int) TO service_role;