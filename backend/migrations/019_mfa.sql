-- 019_mfa.sql
-- Multi-factor authentication: TOTP enrollment, factor registry, and AAL2 enforcement.
-- Idempotent; safe to re-run.

-- ---- factor registry ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mfa_factors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('totp', 'webauthn')),
  name TEXT NOT NULL,
  secret TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('verified', 'unverified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  UNIQUE (user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_mfa_factors_user
  ON public.mfa_factors(user_id, status);

ALTER TABLE public.mfa_factors ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON public.mfa_factors FROM %I', r);
    END IF;
  END LOOP;
END $$;

-- Only the owner can read/write their own factors.
CREATE POLICY mfa_factors_owner ON public.mfa_factors
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---- session audit -----------------------------------------------------------
-- Records login/logout events for the audit log viewer.
CREATE TABLE IF NOT EXISTS public.session_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('login', 'logout', 'force_signout', 'mfa_challenge')),
  aal TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_events_user
  ON public.session_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_events_created
  ON public.session_events(created_at DESC);

ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON public.session_events FROM %I', r);
    END IF;
  END LOOP;
END $$;

-- Only service-role can write; users can read their own.
CREATE POLICY session_events_read ON public.session_events
  FOR SELECT USING (auth.uid() = user_id);