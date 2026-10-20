-- 004_departments_courses.sql
--
-- Introduces the admin-managed catalog (departments, courses) and the profile
-- columns the messaging permission engine depends on. See Messaging_plan.md §3.
--
-- Design:
--   * Departments/courses are RUNTIME DATA — created and edited by admins in the
--     app, never hardcoded. Every reference is a UUID, so renaming or reordering
--     an entry can never change who may message whom.
--   * Soft-delete only (`is_active`): profiles and courses reference these rows,
--     so a hard delete would orphan them. Courses additionally use
--     ON DELETE RESTRICT to make an accidental drop impossible.
--   * `message_policy` is the per-user "who can message me" setting
--     (everyone | department | selected | nobody); default 'department'.
--
-- Idempotent: safe to run repeatedly.
-- Apply with: node scripts/run-sql.js migrations/004_departments_courses.sql

-- Same trigger helper as 002 (recreated so this migration is self-contained).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE,                   -- optional short code, e.g. 'CCS'
  name TEXT NOT NULL,                 -- 'College of Computer Studies'
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  code TEXT,                          -- optional short code, e.g. 'BSIT'
  name TEXT NOT NULL,                 -- 'BS Information Technology'
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_courses_department_name UNIQUE (department_id, name)
);

CREATE INDEX IF NOT EXISTS idx_departments_active ON public.departments(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_courses_department ON public.courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_active ON public.courses(is_active, sort_order);

-- Profile assignment + messaging preference.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id),
  ADD COLUMN IF NOT EXISTS message_policy TEXT NOT NULL DEFAULT 'department'
    CHECK (message_policy IN ('everyone', 'department', 'selected', 'nobody'));

CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department_id);

DROP TRIGGER IF EXISTS set_departments_updated_at ON public.departments;
CREATE TRIGGER set_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_courses_updated_at ON public.courses;
CREATE TRIGGER set_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Deny-by-default, consistent with the rest of the schema: the Expo app never
-- talks to PostgREST for these tables (all access is via the Express API, which
-- connects as the table owner). Revoke the public API roles explicitly.
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON public.departments, public.courses FROM %I',
        r
      );
    END IF;
  END LOOP;
END $$;
