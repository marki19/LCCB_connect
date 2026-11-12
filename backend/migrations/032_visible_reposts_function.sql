-- 032_visible_reposts_function.sql
-- Add visible_reposts(viewer text) function for feed queries
-- Mirrors visible_posts() logic but for reposts table

BEGIN;

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

-- Lock down function
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.visible_reposts(text) FROM %I', r);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.visible_reposts(text) FROM PUBLIC;

COMMIT;