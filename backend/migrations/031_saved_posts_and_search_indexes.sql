-- 031_saved_posts_and_search_indexes.sql
-- Saved posts bookmarking table + full-text & trigram indexes for search engine

BEGIN;

-- ---- 1. Saved posts table ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT saved_posts_unique_user_post UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_posts_user_created
  ON public.saved_posts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id
  ON public.saved_posts (post_id);

-- ---- 2. RLS for saved posts -------------------------------------------------

ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_posts_read_own" ON public.saved_posts
  FOR SELECT
  USING (user_id = current_setting('request.jwt.claim.sub', true)::text);

CREATE POLICY "saved_posts_insert_own" ON public.saved_posts
  FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true)::text);

CREATE POLICY "saved_posts_delete_own" ON public.saved_posts
  FOR DELETE
  USING (user_id = current_setting('request.jwt.claim.sub', true)::text);

-- ---- 3. Full-Text Search and Trigram Extension & Indexes -------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram fuzzy indexes (typo tolerance & substring similarity)
CREATE INDEX IF NOT EXISTS idx_profiles_trgm_name
  ON public.profiles USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_trgm_username
  ON public.profiles USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posts_trgm_content
  ON public.posts USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_posts_trgm_title
  ON public.posts USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_theses_trgm_title
  ON public.theses USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_theses_trgm_abstract
  ON public.theses USING gin (abstract gin_trgm_ops);

-- Full-text search inverted indexes (lexemes & stemming)
CREATE INDEX IF NOT EXISTS idx_theses_fts
  ON public.theses USING gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(abstract, '')));

CREATE INDEX IF NOT EXISTS idx_posts_fts
  ON public.posts USING gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')));

CREATE INDEX IF NOT EXISTS idx_profiles_fts
  ON public.profiles USING gin (to_tsvector('english', coalesce(full_name, '') || ' ' || coalesce(username, '') || ' ' || coalesce(bio, '')));

COMMIT;

