-- 047_user_role.sql
-- New accounts default to role = 'user' and choose an intended role at onboarding.
-- Superadmins never verify; verification requests are constrained to student, faculty,
-- departmentAdmin, and admin. Adds escalated_at for stranded queue routing.

BEGIN;

-- 1. Profiles default to 'user'
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';

-- 2. Update chk_profiles_role constraint to include 'user'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_role;

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_role CHECK (
    role IS NULL OR role IN (
      'user',
      'student',
      'faculty',
      'departmentAdmin',
      'department_admin',
      'admin',
      'superadmin',
      'superAdmin'
    )
  );

-- 3. Tighten chk_verification_role_shape: exclude 'superadmin'
ALTER TABLE public.profile_verification_requests
  DROP CONSTRAINT IF EXISTS chk_verification_role_shape;

ALTER TABLE public.profile_verification_requests
  ADD CONSTRAINT chk_verification_role_shape CHECK (
    role = ANY (ARRAY['student','faculty','departmentAdmin','admin'])
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
        role = 'admin'
        AND department_id IS NULL
        AND course_id IS NULL
        AND year_level IS NULL
      )
    )
  );

-- 4. Add escalated_at for departments lacking departmentAdmin reviewers
ALTER TABLE public.profile_verification_requests
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_verification_escalated
  ON public.profile_verification_requests (escalated_at)
  WHERE escalated_at IS NOT NULL;

COMMIT;
