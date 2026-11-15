-- 030_alter_friendships_rls.sql
-- Friendships table exists; add RLS policies

BEGIN;

-- ---- 1. Enable RLS and add policies ----------------------------------------

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Users can read friendships where they are requester or addressee
CREATE POLICY "friendships_read_involved" ON public.friendships
  FOR SELECT
  USING (
    requester_id = current_setting('request.jwt.claim.sub', true)::text
    OR addressee_id = current_setting('request.jwt.claim.sub', true)::text
  );

-- Users can insert friendship requests (as requester)
CREATE POLICY "friendships_insert_requester" ON public.friendships
  FOR INSERT
  WITH CHECK (
    requester_id = current_setting('request.jwt.claim.sub', true)::text
    AND requester_id <> addressee_id
  );

-- Addressee can update status (accept/decline)
CREATE POLICY "friendships_update_addressee" ON public.friendships
  FOR UPDATE
  USING (addressee_id = current_setting('request.jwt.claim.sub', true)::text)
  WITH CHECK (addressee_id = current_setting('request.jwt.claim.sub', true)::text);

-- Requester can delete (cancel) their own pending request
CREATE POLICY "friendships_delete_requester" ON public.friendships
  FOR DELETE
  USING (
    requester_id = current_setting('request.jwt.claim.sub', true)::text
    AND status = 'pending'
  );

-- Either party can delete (unfriend) accepted friendship
CREATE POLICY "friendships_delete_either" ON public.friendships
  FOR DELETE
  USING (
    status = 'accepted'
    AND (requester_id = current_setting('request.jwt.claim.sub', true)::text
         OR addressee_id = current_setting('request.jwt.claim.sub', true)::text)
  );

-- Admin can read all
CREATE POLICY "friendships_admin_read_all" ON public.friendships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = current_setting('request.jwt.claim.sub', true)::text
        AND p.role IN ('campus_admin', 'department_admin', 'super_admin')
    )
  );

COMMIT;