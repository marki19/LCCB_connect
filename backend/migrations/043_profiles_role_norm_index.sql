-- 043_profiles_role_norm_index.sql
--
-- `profiles.role` is stored mixed-case: chk_profiles_role permits both
-- 'superadmin' and 'superAdmin', and both 'departmentAdmin' and
-- 'department_admin'. Code that needs one canonical comparison uses
-- public.normalize_role() (migration 041), but a function call in a WHERE
-- clause is not sargable on its own.
--
-- This expression index keeps `normalize_role(role)` index-backed so
-- notification fan-out (getTargetAdmins) does not sequentially scan profiles
-- on every post, thesis, or moderation event.
--
-- normalize_role() is declared IMMUTABLE, which is a prerequisite for indexing.

CREATE INDEX IF NOT EXISTS idx_profiles_role_norm
  ON public.profiles (public.normalize_role(role));
