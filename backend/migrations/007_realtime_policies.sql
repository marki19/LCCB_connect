-- 007_realtime_policies.sql
--
-- Private-channel authorization for Realtime (Messaging_plan.md §8):
--   * Presence on the global `presence:campus` channel — any authenticated user.
--   * Typing Broadcast on `conv:<conversation_id>` — participants only.
--
-- The `realtime` schema is locked: do NOT create tables/functions there, and do
-- NOT `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY` (RLS is already
-- on; the ALTER fails with "must be owner of table messages" and aborts the
-- transaction). Managing RLS policies on `realtime.messages` IS allowed for the
-- `postgres` role via supautils. (Verified against the Supabase Realtime
-- Authorization docs.)
--
-- Also set the dashboard toggle: Realtime → Settings → **disable "Allow public
-- access"** so `private: true` channels are enforced.
--
-- Idempotent. Apply with:
--   node scripts/run-sql.js migrations/007_realtime_policies.sql

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'realtime' AND c.relname = 'messages'
  ) THEN
    RAISE NOTICE 'realtime.messages not found; skipping realtime channel policies';
    RETURN;
  END IF;

  -- Presence: read + track on the campus channel.
  EXECUTE $p$DROP POLICY IF EXISTS "realtime presence campus read" ON realtime.messages$p$;
  EXECUTE $p$CREATE POLICY "realtime presence campus read" ON realtime.messages
    FOR SELECT TO authenticated
    USING (extension = 'presence' AND (SELECT realtime.topic()) = 'presence:campus')$p$;

  EXECUTE $p$DROP POLICY IF EXISTS "realtime presence campus write" ON realtime.messages$p$;
  EXECUTE $p$CREATE POLICY "realtime presence campus write" ON realtime.messages
    FOR INSERT TO authenticated
    WITH CHECK (extension = 'presence' AND (SELECT realtime.topic()) = 'presence:campus')$p$;

  -- Typing/broadcast: conversation participants only.
  EXECUTE $p$DROP POLICY IF EXISTS "realtime conversation broadcast read" ON realtime.messages$p$;
  EXECUTE $p$CREATE POLICY "realtime conversation broadcast read" ON realtime.messages
    FOR SELECT TO authenticated
    USING (
      extension = 'broadcast'
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE ('conv:' || c.id::text) = (SELECT realtime.topic())
          AND (c.user_a = (SELECT auth.uid())::text OR c.user_b = (SELECT auth.uid())::text)
      )
    )$p$;

  EXECUTE $p$DROP POLICY IF EXISTS "realtime conversation broadcast write" ON realtime.messages$p$;
  EXECUTE $p$CREATE POLICY "realtime conversation broadcast write" ON realtime.messages
    FOR INSERT TO authenticated
    WITH CHECK (
      extension = 'broadcast'
      AND EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE ('conv:' || c.id::text) = (SELECT realtime.topic())
          AND (c.user_a = (SELECT auth.uid())::text OR c.user_b = (SELECT auth.uid())::text)
      )
    )$p$;
END
$do$;
