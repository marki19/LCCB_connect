-- 036_department_post_visibility.sql
-- Add 'department' to content_visibility enum and update visibility functions
-- Ensures posts, theses, and reposts with 'department' visibility can only be seen and interacted
-- with by users belonging to the same department.

ALTER TYPE public.content_visibility ADD VALUE IF NOT EXISTS 'department';

BEGIN;

-- 1. Update visible_posts(viewer)
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
      OR (
        p.visibility = 'department'
        AND EXISTS (
          SELECT 1 FROM public.profiles viewer_pr
          WHERE viewer_pr.id = viewer
            AND viewer_pr.department_id IS NOT NULL
            AND viewer_pr.department_id = p.author_department_id
        )
      )
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

-- 2. Update visible_theses(viewer)
CREATE OR REPLACE FUNCTION public.visible_theses(viewer text)
RETURNS SETOF public.theses
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT t.*
  FROM public.theses t
  WHERE t.moderation_status <> 'hidden'
    AND (
      t.uploader_id = viewer
      OR t.visibility = 'public'
      OR (
        t.visibility = 'department'
        AND EXISTS (
          SELECT 1 FROM public.profiles viewer_pr
          WHERE viewer_pr.id = viewer
            AND viewer_pr.department_id IS NOT NULL
            AND (
              viewer_pr.department_id = (SELECT pr.department_id FROM public.profiles pr WHERE pr.id = t.uploader_id)
              OR viewer_pr.department_id = (SELECT c.department_id FROM public.courses c WHERE c.id = t.course_id)
            )
        )
      )
      OR (t.visibility = 'friends' AND public.is_friend(t.uploader_id, viewer))
      OR (
        t.visibility = 'custom'
        AND EXISTS (
          SELECT 1
          FROM public.thesis_audience a
          WHERE a.thesis_id = t.id AND a.user_id = viewer
        )
      )
      OR (
        t.visibility = 'private'
        AND t.uploader_id = viewer
      )
    );
$$;

-- 3. Update visible_reposts(viewer)
CREATE OR REPLACE FUNCTION public.visible_reposts(viewer text)
RETURNS SETOF public.reposts
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT r.*
  FROM public.reposts r
  JOIN public.posts p ON p.id = r.original_post_id
  WHERE r.deleted_at IS NULL
    AND p.moderation_status <> 'hidden'
    AND p.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = r.reposter_id AND b.blocked_id = viewer)
         OR (b.blocker_id = viewer AND b.blocked_id = r.reposter_id)
    )
    AND (
      r.reposter_id = viewer
      OR r.visibility = 'public'
      OR (
        r.visibility = 'department'
        AND EXISTS (
          SELECT 1 FROM public.profiles viewer_pr
          WHERE viewer_pr.id = viewer
            AND viewer_pr.department_id IS NOT NULL
            AND viewer_pr.department_id = (SELECT pr.department_id FROM public.profiles pr WHERE pr.id = r.reposter_id)
        )
      )
      OR (r.visibility = 'friends' AND public.is_friend(r.reposter_id, viewer))
      OR (
        r.visibility = 'custom'
        AND EXISTS (
          SELECT 1
          FROM public.post_audience a
          WHERE a.post_id = r.id AND a.user_id = viewer
        )
      )
      OR (
        r.visibility = 'private'
        AND r.reposter_id = viewer
      )
    );
$$;

-- 4. Lock down functions
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.visible_posts(text) FROM %I', r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.visible_theses(text) FROM %I', r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.visible_reposts(text) FROM %I', r);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.visible_posts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.visible_theses(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.visible_reposts(text) FROM PUBLIC;

COMMIT;

