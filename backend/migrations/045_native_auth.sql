-- 045_native_auth.sql
--
-- Enables 100% independent, self-hosted authentication without Supabase GoTrue.
-- Stores bcrypt password hashes and confirmation timestamps directly on public.profiles.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;

-- Index on email is already present or reinforced for fast login lookup
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (LOWER(email));

