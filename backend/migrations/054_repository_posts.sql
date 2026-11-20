-- 054_repository_posts.sql
-- Add kind, repository_type, repository_category, live_url, and post_attachments table

BEGIN;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'discussion',
  ADD COLUMN IF NOT EXISTS repository_type TEXT,
  ADD COLUMN IF NOT EXISTS repository_category TEXT,
  ADD COLUMN IF NOT EXISTS live_url TEXT;

UPDATE public.posts SET kind='repository', repository_type='project'
  WHERE type IN ('project','website');
UPDATE public.posts SET kind='repository', repository_type='capstone'
  WHERE type='capstone';
UPDATE public.posts SET kind='announcement' WHERE type='announcement';

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_kind_check,
  DROP CONSTRAINT IF EXISTS posts_repository_type_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_kind_check CHECK (kind IN ('discussion','repository','announcement')),
  ADD CONSTRAINT posts_repository_type_check CHECK (
    (kind='repository' AND repository_type IN ('project','capstone','thesis'))
    OR (kind<>'repository' AND repository_type IS NULL)
  );

CREATE INDEX IF NOT EXISTS posts_kind_type_created_idx
  ON public.posts (kind, repository_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.post_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, storage_key)
);

CREATE INDEX IF NOT EXISTS post_attachments_post_idx ON public.post_attachments (post_id, sort_order);

CREATE OR REPLACE FUNCTION public.visible_post_attachments(viewer text)
RETURNS SETOF public.post_attachments
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT a.* FROM public.post_attachments a
  WHERE EXISTS (SELECT 1 FROM public.visible_posts(viewer) p WHERE p.id = a.post_id);
$$;

-- Backfill images from image_urls / image_url into post_attachments
INSERT INTO public.post_attachments (post_id, storage_key, file_name, mime_type, sort_order)
SELECT
  p.id,
  img.storage_key,
  COALESCE(NULLIF(regexp_replace(img.storage_key, '^.*/', ''), ''), 'image.jpg') AS file_name,
  CASE
    WHEN img.storage_key ILIKE '%.png' THEN 'image/png'
    WHEN img.storage_key ILIKE '%.webp' THEN 'image/webp'
    WHEN img.storage_key ILIKE '%.gif' THEN 'image/gif'
    WHEN img.storage_key ILIKE '%.heic' THEN 'image/heic'
    ELSE 'image/jpeg'
  END AS mime_type,
  (img.ord - 1)::integer AS sort_order
FROM public.posts p,
LATERAL (
  SELECT val AS storage_key, ord
  FROM unnest(
    CASE
      WHEN p.image_urls IS NOT NULL AND cardinality(p.image_urls) > 0 THEN p.image_urls
      WHEN p.image_url IS NOT NULL THEN ARRAY[p.image_url]
      ELSE ARRAY[]::text[]
    END
  ) WITH ORDINALITY AS u(val, ord)
) img
WHERE img.storage_key IS NOT NULL AND btrim(img.storage_key) <> ''
ON CONFLICT (post_id, storage_key) DO NOTHING;

COMMIT;
