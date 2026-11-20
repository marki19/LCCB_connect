-- 061_snap_comments.sql
-- Comments and one-level replies on Quick Snaps.
--
-- Why a separate table
--   Snap comments are 24-hour, audience-scoped, and deleted with the snap
--   (ON DELETE CASCADE). The post `comments` table carries moderation columns
--   and post-shaped foreign keys, none of which apply here.
--
-- Replies
--   Exactly one level: a row may point at a top-level comment on the same snap,
--   never at another reply. The API enforces that; the index keeps the thread
--   read cheap.
--
-- Posture
--   RLS enabled with no policies, matching every other table in `public` (see
--   001_rls_hardening.sql and 060_snap_rls.sql). All access goes through the
--   Express API, which connects as the table owner and bypasses RLS.
--
-- Idempotent: safe to run more than once.
-- Run with:  node scripts/migrate.js

BEGIN;

CREATE TABLE IF NOT EXISTS public.snap_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snap_id UUID NOT NULL REFERENCES public.snaps(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.snap_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snap_comments_snap
  ON public.snap_comments(snap_id, created_at);

CREATE INDEX IF NOT EXISTS idx_snap_comments_parent
  ON public.snap_comments(parent_id)
  WHERE parent_id IS NOT NULL;

ALTER TABLE public.snap_comments ENABLE ROW LEVEL SECURITY;

-- Defence in depth: revoke the public API roles if a previous grant exists.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON public.snap_comments FROM %I', r);
    END IF;
  END LOOP;
END $$;

COMMIT;
