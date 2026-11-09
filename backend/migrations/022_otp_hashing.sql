-- 022_otp_hashing.sql
-- Signup OTPs are stored as an HMAC, never in plaintext.
--
-- Rows written before this migration hold a plaintext code. They expire within
-- 10 minutes, so dropping them is cheaper and safer than trying to backfill a
-- value we should not keep.

ALTER TABLE public.pending_signups
  ADD COLUMN IF NOT EXISTS otp_hash TEXT;

ALTER TABLE public.pending_signups
  ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0;

DELETE FROM public.pending_signups WHERE otp_hash IS NULL;

ALTER TABLE public.pending_signups
  ALTER COLUMN otp_hash SET NOT NULL;

ALTER TABLE public.pending_signups
  DROP COLUMN IF EXISTS otp_code;
