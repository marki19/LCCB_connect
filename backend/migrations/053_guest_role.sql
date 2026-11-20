-- Migration 053: Visitor Guest Role & Contact Visibility Scope
--
-- 1. Allow role = 'guest' in chk_profiles_role constraint.
-- 2. Add contact_scope column to profiles: 'public' (visible to all including visitors),
--    'organization' (default, visible to authenticated LCCB campus members only),
--    'private' (hidden from public profile).

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_role;

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_role CHECK (
    role IS NULL OR role IN (
      'guest',
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

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_scope TEXT NOT NULL DEFAULT 'organization'
  CHECK (contact_scope IN ('public', 'organization', 'private'));
