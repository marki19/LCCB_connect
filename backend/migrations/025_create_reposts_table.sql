-- 025_create_reposts_table.sql
-- Reposts as a separate table (not a post type)
-- UNIQUE (reposter_id, original_post_id) prevents duplicate reposts
-- Reposting a repost resolves to the original post

BEGIN;

-- ---- 1. Create reposts table ------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reposts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reposter_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  caption TEXT,
  visibility public.content_visibility NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT reposts_unique_reposter_original UNIQUE (reposter_id, original_post_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reposts_original_post
  ON public.reposts (original_post_id);
CREATE INDEX IF NOT EXISTS idx_reposts_reposter_created
  ON public.reposts (reposter_id, created_at DESC);

-- RLS
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

-- Anyone can read non-deleted reposts (visibility enforced at query layer)
CREATE POLICY "reposts_read_all" ON public.reposts
  FOR SELECT
  USING (deleted_at IS NULL);

-- Reposter can insert their own reposts
CREATE POLICY "reposts_insert_self" ON public.reposts
  FOR INSERT
  WITH CHECK (reposter_id = current_setting('request.jwt.claim.sub', true)::text);

-- Reposter can soft-delete their own reposts
CREATE POLICY "reposts_delete_self" ON public.reposts
  FOR UPDATE
  USING (reposter_id = current_setting('request.jwt.claim.sub', true)::text)
  WITH CHECK (reposter_id = current_setting('request.jwt.claim.sub', true)::text);

-- ---- 2. Function to get visible reposts for a post --------------------------

CREATE OR REPLACE FUNCTION public.visible_reposts_for_post(original_post_id uuid, viewer text)
RETURNS SETOF public.reposts
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT r.*
  FROM public.reposts r
  JOIN public.posts p ON p.id = r.original_post_id
  WHERE r.deleted_at IS NULL
    AND r.original_post_id = original_post_id
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
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = r.reposter_id AND b.blocked_id = viewer)
         OR (b.blocker_id = viewer AND b.blocked_id = r.reposter_id)
    );
$$;

-- Lock down function
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.visible_reposts_for_post(uuid, text) FROM %I', r);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.visible_reposts_for_post(uuid, text) FROM PUBLIC;

COMMIT;