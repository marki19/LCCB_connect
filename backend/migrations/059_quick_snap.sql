-- 059_quick_snap.sql
-- Quick Snap / Stories: 24-hour photo & video status with visibility, views, and reactions.

BEGIN;

CREATE TABLE IF NOT EXISTS public.snaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_key TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  visibility public.content_visibility NOT NULL DEFAULT 'public',
  author_department_id UUID REFERENCES public.departments(id),
  moderation_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('approved', 'flagged', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_snaps_author_expires ON public.snaps(author_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_snaps_expires_at ON public.snaps(expires_at);

CREATE TABLE IF NOT EXISTS public.snap_views (
  snap_id UUID NOT NULL REFERENCES public.snaps(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (snap_id, viewer_id)
);

CREATE TABLE IF NOT EXISTS public.snap_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snap_id UUID NOT NULL REFERENCES public.snaps(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snap_id, user_id)
);

-- Active visible snaps function for viewer
CREATE OR REPLACE FUNCTION public.visible_snaps(viewer text)
RETURNS SETOF public.snaps
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT s.*
  FROM public.snaps s
  WHERE s.moderation_status <> 'hidden'
    AND s.expires_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = s.author_id AND b.blocked_id = viewer)
         OR (b.blocker_id = viewer AND b.blocked_id = s.author_id)
    )
    AND (
      s.author_id = viewer
      OR s.visibility = 'public'
      OR (
        s.visibility = 'department'
        AND EXISTS (
          SELECT 1 FROM public.profiles viewer_pr
          WHERE viewer_pr.id = viewer
            AND viewer_pr.department_id IS NOT NULL
            AND viewer_pr.department_id = s.author_department_id
        )
      )
      OR (s.visibility = 'friends' AND public.is_friend(s.author_id, viewer))
      OR (s.visibility = 'private' AND s.author_id = viewer)
    );
$$;

COMMIT;
