-- 027_create_blocks_table.sql
-- Blocks table already exists; add missing index and RLS policies

BEGIN;

-- ---- 1. Add index on blocked_id for reverse lookups ------------------------

CREATE INDEX IF NOT EXISTS idx_blocks_blocked
  ON public.blocks (blocked_id);

-- ---- 2. RLS policies --------------------------------------------------------

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- Blocker can read their own blocks
CREATE POLICY "blocks_read_own" ON public.blocks
  FOR SELECT
  USING (blocker_id = current_setting('request.jwt.claim.sub', true)::text);

-- Blocker can insert their own blocks
CREATE POLICY "blocks_insert_self" ON public.blocks
  FOR INSERT
  WITH CHECK (blocker_id = current_setting('request.jwt.claim.sub', true)::text);

-- Blocker can delete (unblock) their own blocks
CREATE POLICY "blocks_delete_self" ON public.blocks
  FOR DELETE
  USING (blocker_id = current_setting('request.jwt.claim.sub', true)::text);

-- Admin can read all blocks
CREATE POLICY "blocks_admin_read_all" ON public.blocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = current_setting('request.jwt.claim.sub', true)::text
        AND p.role IN ('campus_admin', 'department_admin', 'super_admin')
    )
  );

COMMIT;