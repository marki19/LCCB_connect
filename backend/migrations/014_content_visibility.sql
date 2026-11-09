-- 014_content_visibility.sql
--
-- Per-item visibility for posts and theses.
--
--   public  — anyone, including guests
--   friends — the author's accepted friends only
--   custom  — the specific friends listed in <resource>_audience
--   private — the author only
--
-- The rule lives in the table-valued functions `visible_posts(viewer)` and
-- `visible_theses(viewer)`. Every user-facing read selects FROM those, so a new
-- endpoint cannot forget the clause. Moderation and admin paths select from the
-- base tables on purpose: a moderator who cannot see a hidden or private row
-- cannot moderate it.
--
-- `viewer` is NULL for guests; every branch then evaluates false/NULL and only
-- `public` rows survive.
--
-- The viewer id is attacker-controlled if these functions are ever callable
-- over PostgREST, so EXECUTE is revoked from the public API roles below. The
-- Express API connects as the table owner and is unaffected.

BEGIN;

-- ---- 1. Enum + columns -----------------------------------------------------

DO $$
BEGIN
  CREATE TYPE public.content_visibility AS ENUM ('public', 'friends', 'custom', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility public.content_visibility NOT NULL DEFAULT 'public';
ALTER TABLE public.theses
  ADD COLUMN IF NOT EXISTS visibility public.content_visibility NOT NULL DEFAULT 'public';

-- ---- 2. Per-item audience lists (custom visibility) ------------------------
--
-- Two tables rather than one polymorphic table so the foreign keys cascade and
-- no orphan-cleanup job is needed.

CREATE TABLE IF NOT EXISTS public.post_audience (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.thesis_audience (
  thesis_id UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (thesis_id, user_id)
);

-- Reverse lookup: "which items was I explicitly added to?"
CREATE INDEX IF NOT EXISTS idx_post_audience_user
  ON public.post_audience (user_id);
CREATE INDEX IF NOT EXISTS idx_thesis_audience_user
  ON public.thesis_audience (user_id);

-- ---- 3. The one copy of the rule -------------------------------------------

-- Compares friendship pairs in normalized form so the existing
-- `uq_friends_pair` expression index is used instead of a sequential scan.
-- The normalized comparison is also NULL-safe by construction: `least()` and
-- `greatest()` ignore NULL arguments, so a guest viewer can never match a row
-- that satisfies `requester_id <> addressee_id`.
CREATE OR REPLACE FUNCTION public.is_friend(a text, b text)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND least(f.requester_id, f.addressee_id) = least(a, b)
      AND greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  );
$$;

CREATE OR REPLACE FUNCTION public.visible_posts(viewer text)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT p.*
  FROM public.posts p
  WHERE p.moderation_status <> 'hidden'
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
    );
$$;

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
      OR (t.visibility = 'friends' AND public.is_friend(t.uploader_id, viewer))
      OR (
        t.visibility = 'custom'
        AND EXISTS (
          SELECT 1
          FROM public.thesis_audience a
          WHERE a.thesis_id = t.id AND a.user_id = viewer
        )
      )
    );
$$;

-- ---- 4. Lock the functions down -------------------------------------------
-- The viewer argument is caller-supplied. If `anon` could execute these over
-- RPC it could pass any user id and read that user's private rows.

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.visible_posts(text) FROM %I', r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.visible_theses(text) FROM %I', r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.is_friend(text, text) FROM %I', r);
      EXECUTE format('REVOKE ALL ON public.post_audience, public.thesis_audience FROM %I', r);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.visible_posts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.visible_theses(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_friend(text, text) FROM PUBLIC;
REVOKE ALL ON public.post_audience, public.thesis_audience FROM PUBLIC;

-- ---- 5. RLS on the new tables ---------------------------------------------
-- Same posture as every other table: deny-by-default. Audience membership is
-- only ever read through the Express API.

ALTER TABLE public.post_audience   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thesis_audience ENABLE ROW LEVEL SECURITY;

COMMIT;
