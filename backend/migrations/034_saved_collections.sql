-- Migration 034: Saved Collections & Items
-- Enables Facebook-style collections for saved items

CREATE TABLE IF NOT EXISTS public.saved_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_private boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_collections_name_user_uniq UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.saved_collection_items (
  collection_id uuid NOT NULL REFERENCES public.saved_collections(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, post_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_collections_user ON public.saved_collections (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_collection_items_post ON public.saved_collection_items (post_id);

-- Enable RLS
ALTER TABLE public.saved_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_collection_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can read own collections" ON public.saved_collections;
CREATE POLICY "Users can read own collections"
  ON public.saved_collections
  FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own collections" ON public.saved_collections;
CREATE POLICY "Users can insert own collections"
  ON public.saved_collections
  FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own collections" ON public.saved_collections;
CREATE POLICY "Users can update own collections"
  ON public.saved_collections
  FOR UPDATE
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own collections" ON public.saved_collections;
CREATE POLICY "Users can delete own collections"
  ON public.saved_collections
  FOR DELETE
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can manage own collection items" ON public.saved_collection_items;
CREATE POLICY "Users can manage own collection items"
  ON public.saved_collection_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_collections sc
      WHERE sc.id = collection_id AND sc.user_id = auth.uid()::text
    )
  );
