ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS url_style text NOT NULL DEFAULT 'u_at';

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_url_style_check
    CHECK (url_style IN ('u', 'u_at', 'clean', 'clean_at'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;