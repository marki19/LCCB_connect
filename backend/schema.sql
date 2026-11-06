-- Run this in your Supabase SQL Editor
-- LCCB Connect Database Schema (Pure Raw SQL)

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  course TEXT,
  year_level TEXT,
  role TEXT DEFAULT 'student' CHECK (
    role IN (
      'student', 'faculty', 'departmentAdmin', 'department_admin',
      'admin', 'superadmin', 'superAdmin'
    )
  ),
  skills TEXT[],
  -- Identity verification (migration 016). `email` is a denormalized copy of
  -- auth.users.email so the API can answer "who owns this address" without
  -- touching the auth schema. `student_id` is the second login identifier.
  email TEXT,
  student_id TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified')),
  verified_at TIMESTAMPTZ,
  -- Account suspension (migration 010). The API treats an expired
  -- `suspended_until` as active; the fields remain until an admin unsuspends.
  suspended_at TIMESTAMPTZ,
  suspended_until TIMESTAMPTZ,
  suspension_reason TEXT,
  suspended_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT profiles_suspension_dates_check CHECK (suspended_until IS NULL OR suspended_at IS NOT NULL)
);

-- One verified owner per student ID, case-insensitive. NULLs are unlimited.
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_student_id
  ON public.profiles (upper(student_id))
  WHERE student_id IS NOT NULL;

-- 1b. Identity verification requests (migration 016). Holds a snapshot of what
-- the student submitted, so a later edit cannot change what the reviewer saw.
CREATE TABLE IF NOT EXISTS public.profile_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','declined')),
  full_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  course_id UUID NOT NULL REFERENCES public.courses(id),
  year_level TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_verification_one_pending
  ON public.profile_verification_requests (user_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_verification_status
  ON public.profile_verification_requests (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_department
  ON public.profile_verification_requests (department_id, status);

DROP TRIGGER IF EXISTS set_verification_updated_at
  ON public.profile_verification_requests;
CREATE TRIGGER set_verification_updated_at
  BEFORE UPDATE ON public.profile_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'project', 'capstone', 'website')),
  title TEXT,
  technologies TEXT[],
  github_url TEXT,
  image_url TEXT,
  preview_metadata JSONB,
  moderation_status TEXT DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'flagged', 'hidden')),
  moderation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Theses table
CREATE TABLE IF NOT EXISTS public.theses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uploader_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  -- Authoritative department link (derived from the uploader); the TEXT column is
  -- a denormalized display value and may be null for campus admins. See 005. The
  -- FK is added after `departments` is created (table order in this file).
  department_id UUID,
  department TEXT,
  category TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  moderation_status TEXT DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'flagged', 'hidden')),
  moderation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Likes table
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 5. Comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  moderation_status TEXT DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'flagged', 'hidden')),
  moderation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  target_id UUID,
  department_id UUID,
  department TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6a. Append-only governance audit log (migration 010).
-- `actor_id` and `target_id` intentionally have no foreign keys: rows must
-- outlive deleted accounts and content. Only the Express API (table owner)
-- writes here; anon/authenticated are revoked below.
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_username TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_label TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6b. Admin-managed catalog: departments & courses (Messaging_plan.md §3).
-- Runtime data — created/edited by admins in the app, never hardcoded. Rows are
-- deactivated (is_active=false), never deleted, so profile/course references
-- stay valid.
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  code TEXT,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_courses_department_name UNIQUE (department_id, name)
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id),
  ADD COLUMN IF NOT EXISTS message_policy TEXT NOT NULL DEFAULT 'department'
    CHECK (message_policy IN ('everyone', 'department', 'selected', 'nobody')),
  -- Presence (Messaging_plan.md §8): selected mode, throttled heartbeat, and the
  -- last-seen opt-in. See migrations/008_profiles_presence.sql.
  ADD COLUMN IF NOT EXISTS presence_mode TEXT NOT NULL DEFAULT 'online'
    CHECK (presence_mode IN ('online', 'away', 'busy', 'dnd', 'invisible')),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_visible BOOLEAN NOT NULL DEFAULT FALSE;

-- Department FKs for tables that appear earlier in this file (theses,
-- notifications). Added here, after the catalog exists, and idempotently so a
-- re-run is a no-op. Names match Postgres' default `<table>_<column>_fkey`
-- (also what migrations/005_department_scope.sql creates).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'theses_department_id_fkey') THEN
    ALTER TABLE public.theses
      ADD CONSTRAINT theses_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_department_id_fkey') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6c. Messaging, presence & social graph (Messaging_plan.md §5–§8).
-- Writes are never granted to anon/authenticated: the Express API is the only
-- write path. The read-only widening (GRANT SELECT + participant RLS) exists so
-- Supabase Realtime can deliver committed rows; see §8 below and
-- migrations/006_messaging_core.sql for the live upgrade path.
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

-- Per-user allow-list for message_policy='selected' (§1, §4).
CREATE TABLE IF NOT EXISTS public.message_policy_departments (
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, department_id)
);

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

CREATE TABLE IF NOT EXISTS public.conversation_state (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_seq BIGINT DEFAULT 0,
  muted_until TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT chk_blocks_distinct CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.message_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, reporter_id)
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_device_tokens_updated_at ON public.device_tokens;
CREATE TRIGGER set_device_tokens_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Filtered UPDATE delivery (delivered/seen) for Postgres Changes.
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 7. Indexes for High-Performance Queries & Moderation
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_moderation ON public.posts(moderation_status);
CREATE INDEX IF NOT EXISTS idx_theses_uploader ON public.theses(uploader_id);
CREATE INDEX IF NOT EXISTS idx_theses_created_at ON public.theses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_theses_moderation ON public.theses(moderation_status);
CREATE INDEX IF NOT EXISTS idx_theses_department_id ON public.theses(department_id);
CREATE INDEX IF NOT EXISTS idx_likes_post ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_moderation ON public.comments(moderation_status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_dept ON public.notifications(department);
CREATE INDEX IF NOT EXISTS idx_notifications_department_id ON public.notifications(department_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON public.departments(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_courses_department ON public.courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_active ON public.courses(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_suspended ON public.profiles(suspended_at) WHERE suspended_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON public.admin_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_log(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_seq ON public.messages(conversation_id, seq);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(recipient_id, conversation_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_undelivered ON public.messages(recipient_id) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_open ON public.message_reports(status) WHERE status = 'open';

-- Enable Row Level Security (deny-by-default) on EVERY table — including
-- notifications, which earlier versions of this file missed.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_policy_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Audit rows are append-only even for the API. TRUNCATE stays an owner-only
-- maintenance operation and is not exposed by any route.
CREATE OR REPLACE FUNCTION public.reject_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_log_append_only ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_append_only
BEFORE UPDATE OR DELETE ON public.admin_audit_log
FOR EACH ROW EXECUTE FUNCTION public.reject_audit_mutation();

-- Drop any decorative blanket policy (e.g. the `USING (true)` policy older
-- migrations created on notifications). Those expose the table to the anon key.
DROP POLICY IF EXISTS "Allow public read-write for notifications" ON public.notifications;

-- The Expo app never talks to PostgREST for these tables — all data access goes
-- through the Express API, which connects as the table owner and bypasses RLS.
-- Never create `USING (true) WITH CHECK (true)` policies: they expose every table
-- to the public anon key. Revoke the public API roles' access instead.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON public.profiles, public.posts, public.theses, public.likes, public.comments, public.notifications, public.admin_audit_log, public.departments, public.courses, public.friendships, public.message_policy_departments, public.conversations, public.messages, public.conversation_state, public.device_tokens, public.blocks, public.message_reports, public.profile_verification_requests FROM %I',
        r
      );
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
    END IF;
  END LOOP;
END $$;

-- 8. Realtime read-only widening (Messaging_plan.md §8). The trace above revoked
-- everything; Realtime Postgres Changes needs SELECT + a participant-scoped RLS
-- policy + the table in the `supabase_realtime` publication, and nothing more.
-- Private-channel (presence/typing) policies live in
-- migrations/007_realtime_policies.sql — they touch the locked `realtime` schema,
-- so they are intentionally not part of this public-schema fresh install.
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

-- 9. Signup domain lockdown (migration 013).
-- The client-side check in register.tsx is not a control: anyone with the public
-- anon key can POST /auth/v1/signup directly. This trigger runs inside Supabase
-- Auth's own insert transaction, so raising aborts the signup and no user row is
-- written. Google OAuth signups carry the same email and are covered too.
CREATE OR REPLACE FUNCTION public.enforce_signup_email_domain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed_domain CONSTANT text := 'lccbonline.edu.ph';
  email_domain text;
BEGIN
  -- Phone-only and anonymous signups carry no email and are not part of this
  -- product's flow; an email rule must not reject them for the wrong reason.
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  email_domain := lower(split_part(NEW.email, '@', 2));

  IF email_domain <> allowed_domain THEN
    RAISE EXCEPTION 'Signups are restricted to % addresses', allowed_domain
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_signup_email_domain() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_signup_email_domain() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS enforce_signup_email_domain ON auth.users;
CREATE TRIGGER enforce_signup_email_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_signup_email_domain();

-- 10. Content visibility (migration 014).
-- Each post/thesis carries one of public / friends / custom / private. The rule
-- lives in visible_posts()/visible_theses() so no read path can forget it; the
-- Express API selects FROM those. Moderation reads the base tables on purpose: a
-- moderator who cannot see a hidden or private row cannot moderate it.
-- EXECUTE is revoked from the public API roles because the viewer argument is
-- caller-supplied: whoever can call visible_posts() could pass any user id.
DO $$
BEGIN
  CREATE TYPE public.content_visibility AS ENUM ('public', 'friends', 'custom', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility public.content_visibility NOT NULL DEFAULT 'public';
ALTER TABLE public.theses
  ADD COLUMN IF NOT EXISTS visibility public.content_visibility NOT NULL DEFAULT 'public';

CREATE TABLE IF NOT EXISTS public.post_audience (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.thesis_audience (
  thesis_id UUID NOT NULL REFERENCES public.theses(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (thesis_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_audience_user
  ON public.post_audience (user_id);
CREATE INDEX IF NOT EXISTS idx_thesis_audience_user
  ON public.thesis_audience (user_id);

-- Normalized pair comparison so the existing uq_friends_pair expression index
-- is used. least()/greatest() ignore NULLs, so a guest viewer (NULL) can never
-- match a row, which satisfies chk_friends_distinct.
CREATE OR REPLACE FUNCTION public.is_friend(a text, b text)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND least(f.requester_id, f.addressee_id) = least(a, b)
      AND greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  );
$$;

CREATE OR REPLACE FUNCTION public.visible_posts(viewer text)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT p.*
  FROM public.posts p
  WHERE p.moderation_status <> 'hidden'
    AND (
      p.author_id = viewer
      OR p.visibility = 'public'
      OR (p.visibility = 'friends' AND public.is_friend(p.author_id, viewer))
      OR (
        p.visibility = 'custom'
        AND EXISTS (
          SELECT 1
          FROM public.post_audience a
          WHERE a.post_id = p.id AND a.user_id = viewer
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.visible_theses(viewer text)
RETURNS SETOF public.theses
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT t.*
  FROM public.theses t
  WHERE t.moderation_status <> 'hidden'
    AND (
      t.uploader_id = viewer
      OR t.visibility = 'public'
      OR (t.visibility = 'friends' AND public.is_friend(t.uploader_id, viewer))
      OR (
        t.visibility = 'custom'
        AND EXISTS (
          SELECT 1
          FROM public.thesis_audience a
          WHERE a.thesis_id = t.id AND a.user_id = viewer
        )
      )
    );
$$;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.visible_posts(text) FROM %I', r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.visible_theses(text) FROM %I', r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.is_friend(text, text) FROM %I', r);
      EXECUTE format('REVOKE ALL ON public.post_audience, public.thesis_audience FROM %I', r);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.visible_posts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.visible_theses(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_friend(text, text) FROM PUBLIC;
REVOKE ALL ON public.post_audience, public.thesis_audience FROM PUBLIC;

ALTER TABLE public.post_audience   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thesis_audience ENABLE ROW LEVEL SECURITY;

-- Upgrading an existing database? Apply migrations/001_rls_hardening.sql instead.
