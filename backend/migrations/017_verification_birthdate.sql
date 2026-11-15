-- 017_verification_birthdate.sql
-- Add birthdate to verification requests (evidence, not public profile data)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profile_verification_requests'
      AND column_name='birthdate'
  ) THEN
    ALTER TABLE public.profile_verification_requests
      ADD COLUMN birthdate DATE;
  END IF;
END $$;