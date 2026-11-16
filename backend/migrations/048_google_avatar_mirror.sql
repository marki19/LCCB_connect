-- 048_google_avatar_mirror.sql
--
-- Adds avatar_source ('google' or 'upload') and google_avatar_url to public.profiles.
-- Backfills existing rows so that uploaded avatars are preserved and not overwritten.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_source TEXT CHECK (avatar_source IN ('google', 'upload')),
  ADD COLUMN IF NOT EXISTS google_avatar_url TEXT;

-- Backfill: Any existing avatar that is an object key or non-Google URL was uploaded directly.
-- If an existing avatar is already a googleusercontent URL, mark it as 'google'.
UPDATE public.profiles
SET avatar_source = CASE
  WHEN avatar_url LIKE '%googleusercontent.com%' THEN 'google'
  ELSE 'upload'
END
WHERE avatar_url IS NOT NULL AND avatar_source IS NULL;
