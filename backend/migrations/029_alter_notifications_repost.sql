-- 029_alter_notifications_repost.sql
-- Add repost_id FK to notifications

BEGIN;

-- ---- 1. Add repost_id column ------------------------------------------------

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS repost_id UUID REFERENCES public.reposts(id) ON DELETE SET NULL;

-- Index for lookup
CREATE INDEX IF NOT EXISTS idx_notifications_repost
  ON public.notifications (repost_id);

-- ---- 2. Optional: Add check constraint for known notification types -------
-- (type is currently text; we keep it flexible but document expected values)
-- Expected types: 'new_post', 'repost', 'like', 'comment', 'friend_request', 'friend_accept', 'message', 'report', 'verification'

COMMIT;