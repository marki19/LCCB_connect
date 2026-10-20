-- 003_profiles_role_check.sql
--
-- Defense-in-depth: constrain profile roles to the set the application
-- understands. Role writes already go through Zod validation + role checks in
-- userController, and RLS revokes client write access to `profiles`; this
-- constraint makes an unexpected privilege value impossible even if a future
-- code path, migration, or manual edit bypasses those layers.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_role'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT chk_profiles_role CHECK (
        role IS NULL OR role IN (
          'student',
          'faculty',
          'departmentAdmin',
          'department_admin',
          'admin',
          'superadmin',
          'superAdmin'
        )
      );
  END IF;
END $$;
