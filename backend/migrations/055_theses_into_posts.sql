-- 055_theses_into_posts.sql
-- Fold theses and thesis_audience into posts and post_attachments.

BEGIN;

-- 1. Migrate thesis rows into posts table as kind='repository', repository_type='thesis'
INSERT INTO public.posts (
  id,
  author_id,
  content,
  kind,
  repository_type,
  repository_category,
  title,
  visibility,
  moderation_status,
  moderation_reason,
  author_department_id,
  created_at,
  updated_at
)
SELECT 
  t.id,
  t.uploader_id,
  t.abstract,
  'repository',
  'thesis',
  t.category,
  t.title,
  t.visibility,
  t.moderation_status,
  t.moderation_reason,
  t.department_id,
  t.created_at,
  t.updated_at
FROM public.theses t
ON CONFLICT (id) DO NOTHING;

-- 2. Migrate PDF documents into post_attachments
INSERT INTO public.post_attachments (
  post_id,
  storage_key,
  file_name,
  mime_type,
  size_bytes,
  sort_order
)
SELECT 
  t.id,
  t.pdf_url,
  split_part(t.pdf_url, '/', 2),
  'application/pdf',
  NULL,
  0
FROM public.theses t
WHERE t.pdf_url IS NOT NULL
ON CONFLICT (post_id, storage_key) DO NOTHING;

-- 3. Migrate custom audience to post_audience
INSERT INTO public.post_audience (post_id, user_id)
SELECT thesis_id, user_id FROM public.thesis_audience
ON CONFLICT DO NOTHING;

-- 4. Re-target existing reports from 'thesis' to 'post'
UPDATE public.reports r
SET target_type = 'post'
WHERE target_type = 'thesis'
  AND NOT EXISTS (
    SELECT 1 FROM public.reports r2
    WHERE r2.reporter_id = r.reporter_id
      AND r2.target_type = 'post'
      AND r2.target_id = r.target_id
  );
DELETE FROM public.reports WHERE target_type = 'thesis';

-- 5. Drop the visible_theses function and legacy tables
DROP FUNCTION IF EXISTS public.visible_theses(text);
DROP TABLE IF EXISTS public.thesis_audience CASCADE;
DROP TABLE IF EXISTS public.theses CASCADE;

COMMIT;
