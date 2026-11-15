-- 033_post_multi_images.sql
-- Add multi-image support (image_urls text[]) to posts table

BEGIN;

-- Add image_urls array column to posts table
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}'::text[];

-- Backfill image_urls from image_url for existing posts with an image
UPDATE public.posts
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL 
  AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL OR array_length(image_urls, 1) = 0);

COMMIT;

