-- 056_post_mentions.sql
-- Table post_mentions and function can_mention(author text, target text)

BEGIN;

CREATE TABLE IF NOT EXISTS public.post_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  mentioned_user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS post_mentions_unique_idx
  ON public.post_mentions (post_id, COALESCE(comment_id, '00000000-0000-0000-0000-000000000000'::uuid), mentioned_user_id);

CREATE INDEX IF NOT EXISTS post_mentions_mentioned_user_idx
  ON public.post_mentions (mentioned_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_mentions_post_idx
  ON public.post_mentions (post_id);

CREATE OR REPLACE FUNCTION public.can_mention(author text, target text)
RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles a JOIN public.profiles t ON t.id = target
    WHERE a.id = author AND a.id <> target
      AND COALESCE(t.role, 'student') <> 'guest'
      AND (
        public.is_friend(author, target)
        OR (a.department_id IS NOT NULL AND a.department_id = t.department_id)
      )
  );
$$;

COMMIT;
