-- 016_identity_verification.sql
-- Identity verification: app-specific student ID, one-step admin approval.
--
-- Two new facts live on `profiles`:
--   email            - the signup address (auth.users.email is the authority,
--                      this is a denormalized copy so the API can answer
--                      "who owns this address" without touching auth schema)
--   student_id      - second login identifier, case-insensitive unique
--   verification_status - unverified | pending | verified
--
-- The one-shot backfill only runs when the columns are first added, so re-running
-- this file cannot silently auto-verify students who are genuinely pending.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
      AND column_name='verification_status'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN email TEXT,
      ADD COLUMN student_id TEXT,
      ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (verification_status IN ('unverified','pending','verified')),
      ADD COLUMN verified_at TIMESTAMPTZ;

    -- Every profile that exists today predates this feature: seeded test
    -- accounts, faculty, and admins must not be locked out.
    UPDATE public.profiles
       SET verification_status = 'verified',
           verified_at = NOW();
  END IF;
END $$;

-- Non-unique: uniqueness of the address itself lives in auth.users.
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));

-- One verified owner per student ID, case-insensitive. NULLs are unlimited.
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_student_id
  ON public.profiles (upper(student_id))
  WHERE student_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.profile_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','declined')),
  -- Snapshot of what the student submitted. Never read from profiles at review
  -- time, so an edit cannot change what the reviewer is looking at.
  full_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  course_id UUID NOT NULL REFERENCES public.courses(id),
  year_level TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_verification_one_pending
  ON public.profile_verification_requests (user_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_verification_status
  ON public.profile_verification_requests (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_department
  ON public.profile_verification_requests (department_id, status);

ALTER TABLE public.profile_verification_requests ENABLE ROW LEVEL SECURITY;

-- Same deny-by-default rule as every other table: only the Express API
-- (table owner) may read or write it.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON public.profile_verification_requests FROM %I', r);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS set_verification_updated_at
  ON public.profile_verification_requests;
CREATE TRIGGER set_verification_updated_at
  BEFORE UPDATE ON public.profile_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();