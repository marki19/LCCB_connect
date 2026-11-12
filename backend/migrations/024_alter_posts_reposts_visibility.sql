-- 024_alter_posts_reposts_visibility.sql
-- Add repost support, department/course snapshot, soft delete, counters
-- Update visible_posts() to respect deleted_at and blocks

BEGIN;

-- ---- 1. Add columns to posts ------------------------------------------------

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS allow_reposts BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS author_department_id UUID REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS author_course_id UUID REFERENCES public.courses(id),
  ADD COLUMN IF NOT EXISTS repost_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Indexes for visibility filtering by department/course
CREATE INDEX IF NOT EXISTS idx_posts_visibility_dept
  ON public.posts (visibility, author_department_id);
CREATE INDEX IF NOT EXISTS idx_posts_visibility_course
  ON public.posts (visibility, author_course_id);
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at
  ON public.posts (deleted_at) WHERE deleted_at IS NOT NULL;

-- ---- 2. Update visible_posts() to include deleted_at and block checks -------

CREATE OR REPLACE FUNCTION public.visible_posts(viewer text)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT p.*
  FROM public.posts p
  WHERE p.moderation_status <> 'hidden'
    AND p.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = p.author_id AND b.blocked_id = viewer)
         OR (b.blocker_id = viewer AND b.blocked_id = p.author_id)
    )
    AND (
      p.author_id = viewer
      OR p.visibility = 'public'
      OR (p.visibility = 'friends' AND public.is_friend(p.author_id, viewer))
      OR (
        p.visibility = 'custom'
        AND EXISTS (
          SELECT 1
          FROM public.post_audience a
          WHERE a.post_id = p.id AND a.user_id = viewer
        )
      )
      OR (
        p.visibility = 'private'
        AND p.author_id = viewer
      )
    );
$$;

-- Note: 'private' visibility is already covered by p.author_id = viewer
-- but we keep it explicit for clarity. The enum doesn't need new values
-- because department/course visibility is enforced via the snapshot columns
-- (author_department_id, author_course_id) in the application layer.

-- ---- 3. Lock down function execution (same as before) -----------------------

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.visible_posts(text) FROM %I', r);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.visible_posts(text) FROM PUBLIC;

COMMIT;