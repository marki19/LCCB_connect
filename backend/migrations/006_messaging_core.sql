-- 006_messaging_core.sql
--
-- Phase 1 (Messaging_plan.md §5–§8): messaging + friends + requests schema, the
-- read-only realtime posture, and the `supabase_realtime` publication.
--
-- Posture: **writes are never granted** to anon/authenticated. The Express API is
-- the only write path (it connects as the table owner and bypasses RLS). The only
-- widening is read-only + participant-scoped: `GRANT SELECT` on
-- messages/conversations/notifications plus narrow RLS policies, so Realtime
-- Postgres Changes can deliver committed rows to the right client.
--
-- Idempotent. Apply with:
--   node scripts/run-sql.js migrations/006_messaging_core.sql
-- (realtime.messages policies live in 007_realtime_policies.sql.)

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

BEGIN;

-- ---- friendships (§5) ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT chk_friends_distinct CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_friends_pair
  ON public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id, status);

-- ---- per-user policy allow-list for message_policy='selected' (§1, §4) -----
CREATE TABLE IF NOT EXISTS public.message_policy_departments (
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, department_id)
);

-- ---- conversations (§7 + §6) ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('requested','active')),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_conversations_pair CHECK (user_a < user_b),
  CONSTRAINT uq_conversations_pair UNIQUE (user_a, user_b)
);

-- ---- messages (§7) ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_msg_id UUID NOT NULL,
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  body TEXT NOT NULL,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_messages_body CHECK (char_length(body) BETWEEN 1 AND 4000),
  CONSTRAINT chk_messages_distinct CHECK (sender_id <> recipient_id),
  CONSTRAINT uq_messages_client UNIQUE (sender_id, client_msg_id)
);

-- ---- per-user conversation state (§7) -------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_state (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_seq BIGINT DEFAULT 0,
  muted_until TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

-- ---- device tokens (§7) ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, token)
);

-- ---- blocks (§7) -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT chk_blocks_distinct CHECK (blocker_id <> blocked_id)
);

-- ---- reports → moderation (§7) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, reporter_id)
);

-- ---- indexes (§7/§6) -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_messages_conversation_seq ON public.messages(conversation_id, seq);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(recipient_id, conversation_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_undelivered ON public.messages(recipient_id) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_open ON public.message_reports(status) WHERE status = 'open';

DROP TRIGGER IF EXISTS set_device_tokens_updated_at ON public.device_tokens;
CREATE TRIGGER set_device_tokens_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Filtered UPDATE delivery (delivered/seen) for Postgres Changes.
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ---- RLS: deny-by-default on the new tables -------------------------------
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_policy_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON public.friendships, public.message_policy_departments, public.conversations, public.messages, public.conversation_state, public.device_tokens, public.blocks, public.message_reports FROM %I',
        r
      );
    END IF;
  END LOOP;
END $$;

-- ---- read-only widening for Realtime (participant-scoped) ------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT SELECT ON public.messages, public.conversations, public.notifications TO authenticated';
  END IF;
END $$;

DROP POLICY IF EXISTS "participants read conversations" ON public.conversations;
CREATE POLICY "participants read conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (user_a = (SELECT auth.uid())::text OR user_b = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "participants read messages" ON public.messages;
CREATE POLICY "participants read messages" ON public.messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.user_a = (SELECT auth.uid())::text OR c.user_b = (SELECT auth.uid())::text)
  ));

DROP POLICY IF EXISTS "owners read notifications" ON public.notifications;
CREATE POLICY "owners read notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid())::text);

-- ---- streamed tables (§8) --------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['messages', 'conversations', 'notifications'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;
