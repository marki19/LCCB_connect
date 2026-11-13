-- 041_announcement_posts.sql
-- Announcements become real posts.
--
-- An announcement is a `posts` row with type='announcement' and
-- visibility='announcement'. Because likes, comments, reposts, saved posts and
-- post_audience all foreign-key to posts.id, engagement and sharing work with no
-- new tables.
--
-- Audience is five nullable columns. NULL means "unconstrained", so:
--   all users          -> every audience column NULL
--   role               -> audience_role only
--   department         -> audience_department_id only
--   course             -> audience_course_id only
--   year level         -> audience_year_level only
--   "3rd Year in BSIT" -> audience_course_id + audience_year_level
-- That keeps visible_posts() to one branch instead of one per combination.
--
-- `visibility='announcement'` exists so no other branch of visible_posts() can
-- grant access: a department-scoped announcement is never 'public'.

-- Role is stored mixed-case ('departmentAdmin' vs 'faculty'). Audience matching
-- compares normalized forms, the same way the admin queries do.
CREATE OR REPLACE FUNCTION public.normalize_role(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT LOWER(REPLACE(REPLACE(COALESCE(value, ''), '_', ''), '-', ''));
$$;

BEGIN;

-- 1. Allow the new post type.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_type_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_type_check
  CHECK (type = ANY (ARRAY['text','image','project','capstone','website','announcement']));

-- 2. Audience, pinning and expiry.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS audience_role TEXT,
  ADD COLUMN IF NOT EXISTS audience_department_id UUID
    REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audience_course_id UUID
    REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audience_year_level TEXT,
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 3. Keep type and visibility in lockstep, and keep the announcement columns off
--    ordinary posts.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS chk_posts_announcement_visibility;
ALTER TABLE public.posts
  ADD CONSTRAINT chk_posts_announcement_visibility
  CHECK ((type = 'announcement') = (visibility = 'announcement'));

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS chk_posts_announcement_fields;
ALTER TABLE public.posts
  ADD CONSTRAINT chk_posts_announcement_fields
  CHECK (
    type = 'announcement'
    OR (
      audience_role IS NULL
      AND audience_department_id IS NULL
      AND audience_course_id IS NULL
      AND audience_year_level IS NULL
      AND pinned = FALSE
      AND expires_at IS NULL
    )
  );

-- 4. Feed index: pinned first, newest next, announcements only.
CREATE INDEX IF NOT EXISTS idx_posts_announcement_feed
  ON public.posts (pinned DESC, created_at DESC)
  WHERE type = 'announcement' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_expires_at
  ON public.posts (expires_at)
  WHERE expires_at IS NOT NULL;

-- 5. visible_posts(): one announcement branch, NULL meaning unconstrained.
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
      -- The author always sees their own post, including an expired announcement.
      p.author_id = viewer
      OR (
        p.visibility = 'announcement'
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND EXISTS (
          SELECT 1
          FROM public.profiles v
          WHERE v.id = viewer
            AND (
              p.audience_role IS NULL
              OR public.normalize_role(v.role) = public.normalize_role(p.audience_role)
            )
            AND (p.audience_department_id IS NULL OR v.department_id = p.audience_department_id)
            AND (p.audience_course_id IS NULL OR v.course_id = p.audience_course_id)
            AND (p.audience_year_level IS NULL OR v.year_level = p.audience_year_level)
        )
      )
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

-- 6. visible_reposts(): a repost is only as visible as the post it carries.
--    Without this, reposting a private post published its contents.
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
    AND EXISTS (
      SELECT 1 FROM public.visible_posts(viewer) vp WHERE vp.id = p.id
    )
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
          WHERE a.post_id = p.id AND a.user_id = viewer
        )
      )
      OR (
        r.visibility = 'private'
        AND r.reposter_id = viewer
      )
    );
$$;

-- 7. Lock the functions down (deny-by-default; only the API role calls them).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.visible_posts(text) FROM %I', r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.visible_reposts(text) FROM %I', r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.normalize_role(text) FROM %I', r);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.visible_posts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.visible_reposts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_role(text) FROM PUBLIC;

COMMIT;
