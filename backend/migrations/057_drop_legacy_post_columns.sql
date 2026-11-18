-- 057_drop_legacy_post_columns.sql
-- Drop legacy columns on posts: type, image_url, image_urls
-- Update announcement constraints and index to use posts.kind instead of posts.type

BEGIN;

-- 1. Drop check constraint posts_type_check
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_type_check;

-- 2. Update announcement constraints to check kind = 'announcement'
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS chk_posts_announcement_fields;

ALTER TABLE public.posts
  ADD CONSTRAINT chk_posts_announcement_fields
  CHECK (((kind = 'announcement'::text) OR ((audience_role IS NULL) AND (audience_department_id IS NULL) AND (audience_course_id IS NULL) AND (audience_year_level IS NULL) AND (pinned = false) AND (expires_at IS NULL))));

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS chk_posts_announcement_visibility;

ALTER TABLE public.posts
  ADD CONSTRAINT chk_posts_announcement_visibility
  CHECK (((kind = 'announcement'::text) = (visibility = 'announcement'::content_visibility)));

-- 3. Update announcement feed index to use kind = 'announcement'
DROP INDEX IF EXISTS idx_posts_announcement_feed;

CREATE INDEX idx_posts_announcement_feed
  ON public.posts USING btree (pinned DESC, created_at DESC)
  WHERE ((kind = 'announcement'::text) AND (deleted_at IS NULL));

-- 4. Drop legacy columns
ALTER TABLE public.posts
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS image_urls;

COMMIT;
