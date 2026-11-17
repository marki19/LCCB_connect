-- 046_refresh_tokens.sql
--
-- Adds server-side refresh token tracking with revocation for native auth session lifecycle.
-- Safely ensures email uniqueness when no duplicates exist.

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON public.refresh_tokens (expires_at);

-- Drop default on email_confirmed_at if it was previously set
DO $$
BEGIN
  ALTER TABLE public.profiles ALTER COLUMN email_confirmed_at DROP DEFAULT;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Add unique index on lower(email) if there are no existing duplicates
DO $$
DECLARE
  has_duplicates BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT lower(email)
    FROM public.profiles
    WHERE email IS NOT NULL
    GROUP BY lower(email)
    HAVING COUNT(*) > 1
  ) INTO has_duplicates;

  IF NOT has_duplicates THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_email_lower
      ON public.profiles (lower(email))
      WHERE email IS NOT NULL;
  ELSE
    RAISE NOTICE 'Skipping uq_profiles_email_lower: duplicate emails exist in profiles table.';
  END IF;
END $$;
