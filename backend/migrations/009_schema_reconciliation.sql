-- 009_schema_reconciliation.sql
-- Enforces NOT NULL constraints on core content/engagement foreign keys
-- verified clean (0 null rows) in live database audit.

ALTER TABLE public.posts
  ALTER COLUMN author_id SET NOT NULL;

ALTER TABLE public.theses
  ALTER COLUMN uploader_id SET NOT NULL;

ALTER TABLE public.likes
  ALTER COLUMN post_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.comments
  ALTER COLUMN post_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL;
