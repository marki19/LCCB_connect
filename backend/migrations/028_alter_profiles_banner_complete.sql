-- 028_alter_profiles_banner_complete.sql
-- Add profile_banner_dismissed flag and computed profile_completed

BEGIN;

-- ---- 1. Add profile_banner_dismissed column --------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_banner_dismissed BOOLEAN NOT NULL DEFAULT FALSE;

-- ---- 2. Add computed profile_completed column -------------------------------
-- Profile is "completed" when required identity fields are filled
-- Required: full_name, student_id, department_id, course_id, year_level, email
-- Note: birthdate is not stored in profiles (only in onboarding flow temporarily)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN GENERATED ALWAYS AS (
    full_name IS NOT NULL
    AND student_id IS NOT NULL
    AND department_id IS NOT NULL
    AND course_id IS NOT NULL
    AND year_level IS NOT NULL
    AND email IS NOT NULL
  ) STORED;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_completed
  ON public.profiles (profile_completed);

COMMIT;