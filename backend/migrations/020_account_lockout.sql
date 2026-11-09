-- Migration 020: Account Lockout
-- Adds failed login attempts tracking and lockout support

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_locked_until ON public.profiles (locked_until) WHERE locked_until IS NOT NULL;