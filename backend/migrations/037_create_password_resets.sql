-- 037_create_password_resets.sql
-- Backend-owned password reset (Option B).
--
-- The client never talks to Supabase Auth for recovery. A request stores a
-- pending row with only an HMAC of the 6-digit code; the verify endpoint
-- compares the submitted code against that hash, then hands the new password
-- to the admin client. Nothing recoverable is ever stored.
--
-- Mirrors pending_signups (migration 018) so the same rate-limit, attempt,
-- and anti-enumeration patterns apply.
--
-- RLS is revoked for every role: the service role is the only writer, and the
-- client has no token that can read these rows. The `user_id` column is kept
-- for future admin auditing but is never exposed through the API.

CREATE TABLE IF NOT EXISTS public.password_resets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- `profiles.id` is TEXT in this schema (it holds a UUID string), so this
  -- column must be TEXT too. Declaring it UUID makes the foreign key
  -- unimplementable and the migration fails.
  user_id       TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  otp_hash      TEXT NOT NULL,
  otp_attempts  INTEGER NOT NULL DEFAULT 0,
  otp_expires_at TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at       TIMESTAMPTZ,
  UNIQUE (email)
);

-- Fast lookup by email (the only read path).
CREATE INDEX IF NOT EXISTS idx_password_resets_email
  ON public.password_resets (email);

-- Expired-row reaper target.
CREATE INDEX IF NOT EXISTS idx_password_resets_expires
  ON public.password_resets (otp_expires_at);

-- No client role can read or write this table. Only the service role (used by
-- the Express backend) touches it, so there is nothing to leak through RLS.
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.password_resets FROM anon;
REVOKE ALL ON public.password_resets FROM authenticated;