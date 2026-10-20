-- 005_department_scope.sql
--
-- Makes `department_id` (the admin-managed catalog UUID) the single source of
-- truth for departmental access, replacing the earlier free-text comparisons on
-- `profiles.course` / `theses.department`.
--
-- Why: with free text, two spellings of the same department ("BSIT" vs "BSIT ")
-- collide, and renaming a department silently re-scopes every moderator and
-- notification target. Access decisions must not depend on a display string.
--
-- Design:
--   * theses.department_id — authoritative link, derived server-side from the
--     uploader's profile at creation. The legacy `department` TEXT is demoted to
--     a denormalized display value and made nullable (campus admins may upload
--     without a department).
--   * notifications.department_id — department-admin notification targeting by
--     id. The legacy `department` TEXT is kept as a display value.
--   * No backfill: the catalog is populated by admins in the app; existing rows
--     keep their text for display and fail closed (no department_id) until
--     recreated. There is no reliable free-text -> catalog mapping to infer.
--
-- Idempotent: safe to run repeatedly.
-- Apply with: node scripts/run-sql.js migrations/005_department_scope.sql

ALTER TABLE public.theses
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- The uploader's department is now the source; a campus admin may have none.
ALTER TABLE public.theses ALTER COLUMN department DROP NOT NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_theses_department_id ON public.theses(department_id);
CREATE INDEX IF NOT EXISTS idx_notifications_department_id ON public.notifications(department_id);
-- idx_profiles_department already exists (migration 004).
