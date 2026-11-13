-- 042_verification_roles.sql
-- Role-specific identity verification with an emailed OTP.
--
-- Every role verifies against their school account (@lccbonline.edu.ph), but the
-- evidence differs by role:
--   student                    name, school ID, department, course, year level, birthdate
--   faculty, departmentAdmin   name, school ID, department, birthdate
--   admin, superadmin          name, school ID, birthdate
-- and superadmins never verify at all.
--
-- `role` is stored on the request so the reviewer queue can be filtered by who a
-- request belongs to, not only by department. The CHECK is the authority on the
-- per-role shape; the controller validates first so the caller gets a useful
-- message.

BEGIN;

ALTER TABLE public.profile_verification_requests
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

ALTER TABLE public.profile_verification_requests
  ALTER COLUMN department_id DROP NOT NULL,
  ALTER COLUMN course_id DROP NOT NULL,
  ALTER COLUMN year_level DROP NOT NULL;

ALTER TABLE public.profile_verification_requests
  DROP CONSTRAINT IF EXISTS chk_verification_role_shape;

ALTER TABLE public.profile_verification_requests
  ADD CONSTRAINT chk_verification_role_shape CHECK (
    role = ANY (ARRAY['student','faculty','departmentAdmin','admin','superadmin'])
    AND (
      (
        role = 'student'
        AND department_id IS NOT NULL
        AND course_id IS NOT NULL
        AND year_level IS NOT NULL
      )
      OR (
        role = ANY (ARRAY['faculty','departmentAdmin'])
        AND department_id IS NOT NULL
        AND course_id IS NULL
        AND year_level IS NULL
      )
      OR (
        role = ANY (ARRAY['admin','superadmin'])
        AND department_id IS NULL
        AND course_id IS NULL
        AND year_level IS NULL
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_verification_role_status
  ON public.profile_verification_requests (role, status, submitted_at DESC);

-- One live challenge per user. Same construction as pending_signups: only an
-- HMAC of `email:code` is stored, so a database dump cannot complete someone's
-- verification.
CREATE TABLE IF NOT EXISTS public.verification_otp (
  user_id     TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.verification_otp ENABLE ROW LEVEL SECURITY;

-- Deny-by-default, like every other table: only the Express API may read or
-- write it.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON public.verification_otp FROM %I', r);
    END IF;
  END LOOP;
END $$;

COMMIT;
