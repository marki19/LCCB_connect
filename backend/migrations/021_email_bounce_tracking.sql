-- Migration 021: Email bounce tracking columns
-- Adds columns to profiles table to track hard bounces from Brevo

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_bounced BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bounce_reason TEXT,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;

-- Partial index for efficient querying of bounced emails
CREATE INDEX IF NOT EXISTS idx_profiles_email_bounced
  ON public.profiles (email_bounced)
  WHERE email_bounced = TRUE;