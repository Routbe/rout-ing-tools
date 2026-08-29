CREATE TABLE public.contact_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'pending',
  error_detail text,
  ip_address text,
  user_agent text,
  referer text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.contact_submissions TO service_role;
GRANT SELECT ON public.contact_submissions TO authenticated;

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read contact submissions"
  ON public.contact_submissions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX contact_submissions_created_at_idx ON public.contact_submissions (created_at DESC);
CREATE INDEX contact_submissions_ip_created_idx ON public.contact_submissions (ip_address, created_at DESC);

CREATE TRIGGER contact_submissions_touch_updated_at
  BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.contact_submissions_recent_count(_ip text, _window_minutes int DEFAULT 10)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select count(*)::int
  from public.contact_submissions
  where _ip is not null
    and ip_address = _ip
    and created_at > now() - make_interval(mins => greatest(_window_minutes, 1))
$$;

REVOKE ALL ON FUNCTION public.contact_submissions_recent_count(text, int) FROM public;
REVOKE ALL ON FUNCTION public.contact_submissions_recent_count(text, int) FROM anon;
REVOKE ALL ON FUNCTION public.contact_submissions_recent_count(text, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.contact_submissions_recent_count(text, int) TO service_role;