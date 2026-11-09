-- 023_totp_replay_guard.sql
-- Adds last_used_step to mfa_factors for TOTP replay protection.
-- Also changes secret column to store encrypted JSON (handled by application).
-- Idempotent; safe to re-run.

-- Add last_used_step column to track the last used counter step
-- This prevents replay attacks by rejecting codes from the same or earlier time steps
ALTER TABLE public.mfa_factors
  ADD COLUMN IF NOT EXISTS last_used_step BIGINT;

-- Add index for efficient lookup of verified factors with last_used_step
CREATE INDEX IF NOT EXISTS idx_mfa_factors_user_verified_step
  ON public.mfa_factors(user_id, status, last_used_step)
  WHERE status = 'verified';