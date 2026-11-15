-- Baseline schema exported from Supabase (public schema)
-- Generated at: 2026-11-09T06:33:24.609Z
-- This file + migrations 001-023 should reconstruct production exactly.

CREATE TYPE content_visibility AS ENUM ('public', 'friends', 'custom', 'private');

CREATE TABLE public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id text NOT NULL,
  actor_username text,
  actor_role text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  target_label text,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE public.blocks (
  blocker_id text NOT NULL,
  blocked_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK ((blocker_id <> blocked_id)),
  FOREIGN KEY (blocked_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (blocker_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  moderation_status text DEFAULT 'approved'::text,
  moderation_reason text,
  PRIMARY KEY (id),
  CHECK ((moderation_status = ANY (ARRAY['approved'::text, 'flagged'::text, 'hidden'::text]))),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.conversation_state (
  conversation_id uuid NOT NULL,
  user_id text NOT NULL,
  last_read_seq bigint DEFAULT 0,
  muted_until timestamp with time zone,
  archived_at timestamp with time zone,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_a text NOT NULL,
  user_b text NOT NULL,
  requester_id text,
  status text NOT NULL DEFAULT 'active'::text,
  last_message_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (user_a, user_b),
  CHECK ((user_a < user_b)),
  CHECK ((status = ANY (ARRAY['requested'::text, 'active'::text]))),
  FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (user_a) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_b) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL,
  code text,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  updated_by text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (department_id, name),
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  updated_by text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (code),
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.device_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  token text NOT NULL,
  platform text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (user_id, token),
  CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text]))),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.friendships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  requester_id text NOT NULL,
  addressee_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  responded_at timestamp with time zone,
  PRIMARY KEY (id),
  CHECK ((requester_id <> addressee_id)),
  CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text]))),
  FOREIGN KEY (addressee_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.likes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.message_policy_departments (
  user_id text NOT NULL,
  department_id uuid NOT NULL,
  PRIMARY KEY (user_id, department_id),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.message_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  reporter_id text NOT NULL,
  reason text,
  status text DEFAULT 'open'::text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (message_id, reporter_id),
  CHECK ((status = ANY (ARRAY['open'::text, 'reviewed'::text, 'dismissed'::text]))),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id text NOT NULL,
  recipient_id text NOT NULL,
  client_msg_id uuid NOT NULL,
  seq bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  body text NOT NULL,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (sender_id, client_msg_id),
  CHECK (((char_length(body) >= 1) AND (char_length(body) <= 4000))),
  CHECK ((sender_id <> recipient_id)),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.mfa_factors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  secret text NOT NULL,
  status text NOT NULL DEFAULT 'unverified'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  verified_at timestamp with time zone,
  PRIMARY KEY (id),
  UNIQUE (user_id, type),
  CHECK ((status = ANY (ARRAY['verified'::text, 'unverified'::text]))),
  CHECK ((type = ANY (ARRAY['totp'::text, 'webauthn'::text]))),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  actor_id text,
  type text NOT NULL,
  target_id uuid,
  department text,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  department_id uuid,
  PRIMARY KEY (id),
  FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.pending_signups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  otp_expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  verified_at timestamp with time zone,
  otp_hash text NOT NULL,
  otp_attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE (email)
);

CREATE TABLE public.post_audience (
  post_id uuid NOT NULL,
  user_id text NOT NULL,
  PRIMARY KEY (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  author_id text NOT NULL,
  content text,
  type text DEFAULT 'text'::text,
  title text,
  technologies text[],
  github_url text,
  image_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  moderation_status text DEFAULT 'approved'::text,
  moderation_reason text,
  preview_metadata jsonb,
  visibility content_visibility NOT NULL DEFAULT 'public'::content_visibility,
  PRIMARY KEY (id),
  CHECK ((moderation_status = ANY (ARRAY['approved'::text, 'flagged'::text, 'hidden'::text]))),
  CHECK ((type = ANY (ARRAY['text'::text, 'image'::text, 'project'::text, 'capstone'::text, 'website'::text]))),
  FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.profile_verification_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  full_name text NOT NULL,
  student_id text NOT NULL,
  department_id uuid NOT NULL,
  course_id uuid NOT NULL,
  year_level text NOT NULL,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_by text,
  reviewed_at timestamp with time zone,
  review_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  birthdate date,
  PRIMARY KEY (id),
  CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text]))),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.profiles (
  id text NOT NULL,
  username text,
  full_name text,
  avatar_url text,
  bio text,
  course text,
  year_level text,
  role text DEFAULT 'student'::text,
  skills text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  department_id uuid,
  course_id uuid,
  message_policy text NOT NULL DEFAULT 'department'::text,
  presence_mode text NOT NULL DEFAULT 'online'::text,
  last_seen_at timestamp with time zone,
  last_seen_visible boolean NOT NULL DEFAULT false,
  suspended_at timestamp with time zone,
  suspended_until timestamp with time zone,
  suspension_reason text,
  suspended_by text,
  email text,
  student_id text,
  verification_status text NOT NULL DEFAULT 'unverified'::text,
  verified_at timestamp with time zone,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamp with time zone,
  email_bounced boolean NOT NULL DEFAULT false,
  bounce_reason text,
  bounced_at timestamp with time zone,
  PRIMARY KEY (id),
  UNIQUE (username),
  CHECK (((role IS NULL) OR (role = ANY (ARRAY['student'::text, 'faculty'::text, 'departmentAdmin'::text, 'department_admin'::text, 'admin'::text, 'superadmin'::text, 'superAdmin'::text])))),
  CHECK ((message_policy = ANY (ARRAY['everyone'::text, 'department'::text, 'selected'::text, 'nobody'::text]))),
  CHECK ((presence_mode = ANY (ARRAY['online'::text, 'away'::text, 'busy'::text, 'dnd'::text, 'invisible'::text]))),
  CHECK (((suspended_until IS NULL) OR (suspended_at IS NOT NULL))),
  CHECK ((verification_status = ANY (ARRAY['unverified'::text, 'pending'::text, 'verified'::text]))),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE public.session_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  aal text,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CHECK ((event_type = ANY (ARRAY['login'::text, 'logout'::text, 'force_signout'::text, 'mfa_challenge'::text]))),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.theses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  uploader_id text NOT NULL,
  title text NOT NULL,
  abstract text NOT NULL,
  department text,
  category text NOT NULL,
  pdf_url text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  moderation_status text DEFAULT 'approved'::text,
  moderation_reason text,
  department_id uuid,
  visibility content_visibility NOT NULL DEFAULT 'public'::content_visibility,
  PRIMARY KEY (id),
  CHECK ((moderation_status = ANY (ARRAY['approved'::text, 'flagged'::text, 'hidden'::text]))),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (uploader_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.thesis_audience (
  thesis_id uuid NOT NULL,
  user_id text NOT NULL,
  PRIMARY KEY (thesis_id, user_id),
  FOREIGN KEY (thesis_id) REFERENCES theses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_admin_audit_action ON public.admin_audit_log USING btree (action, created_at DESC);
CREATE INDEX idx_admin_audit_actor ON public.admin_audit_log USING btree (actor_id, created_at DESC);
CREATE INDEX idx_admin_audit_created ON public.admin_audit_log USING btree (created_at DESC, id DESC);
CREATE INDEX idx_admin_audit_target ON public.admin_audit_log USING btree (target_type, target_id, created_at DESC);
CREATE INDEX idx_comments_moderation ON public.comments USING btree (moderation_status);
CREATE INDEX idx_comments_post ON public.comments USING btree (post_id);
CREATE INDEX idx_conversations_status ON public.conversations USING btree (status, last_message_at DESC);
CREATE INDEX idx_courses_active ON public.courses USING btree (is_active, sort_order);
CREATE INDEX idx_courses_department ON public.courses USING btree (department_id);
CREATE INDEX idx_departments_active ON public.departments USING btree (is_active, sort_order);
CREATE INDEX idx_device_tokens_user ON public.device_tokens USING btree (user_id);
CREATE INDEX idx_friendships_addressee ON public.friendships USING btree (addressee_id, status);
CREATE INDEX idx_likes_post ON public.likes USING btree (post_id);
CREATE INDEX idx_message_reports_open ON public.message_reports USING btree (status) WHERE (status = 'open'::text);
CREATE INDEX idx_messages_conversation_seq ON public.messages USING btree (conversation_id, seq);
CREATE INDEX idx_messages_undelivered ON public.messages USING btree (recipient_id) WHERE (delivered_at IS NULL);
CREATE INDEX idx_messages_unread ON public.messages USING btree (recipient_id, conversation_id) WHERE (read_at IS NULL);
CREATE INDEX idx_mfa_factors_user ON public.mfa_factors USING btree (user_id, status);
CREATE INDEX idx_notifications_department_id ON public.notifications USING btree (department_id);
CREATE INDEX idx_notifications_dept ON public.notifications USING btree (department);
CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (user_id, is_read);
CREATE INDEX idx_pending_signups_created_at ON public.pending_signups USING btree (created_at);
CREATE INDEX idx_pending_signups_email ON public.pending_signups USING btree (email);
CREATE INDEX idx_post_audience_user ON public.post_audience USING btree (user_id);
CREATE INDEX idx_posts_author ON public.posts USING btree (author_id);
CREATE INDEX idx_posts_created_at ON public.posts USING btree (created_at DESC);
CREATE INDEX idx_posts_moderation ON public.posts USING btree (moderation_status);
CREATE INDEX idx_verification_department ON public.profile_verification_requests USING btree (department_id, status);
CREATE INDEX idx_verification_status ON public.profile_verification_requests USING btree (status, submitted_at DESC);
CREATE INDEX idx_profiles_department ON public.profiles USING btree (department_id);
CREATE INDEX idx_profiles_email ON public.profiles USING btree (lower(email));
CREATE INDEX idx_profiles_email_bounced ON public.profiles USING btree (email_bounced) WHERE (email_bounced = true);
CREATE INDEX idx_profiles_locked_until ON public.profiles USING btree (locked_until) WHERE (locked_until IS NOT NULL);
CREATE INDEX idx_profiles_suspended ON public.profiles USING btree (suspended_at) WHERE (suspended_at IS NOT NULL);
CREATE INDEX idx_session_events_created ON public.session_events USING btree (created_at DESC);
CREATE INDEX idx_session_events_user ON public.session_events USING btree (user_id, created_at DESC);
CREATE INDEX idx_theses_created_at ON public.theses USING btree (created_at DESC);
CREATE INDEX idx_theses_department_id ON public.theses USING btree (department_id);
CREATE INDEX idx_theses_moderation ON public.theses USING btree (moderation_status);
CREATE INDEX idx_theses_uploader ON public.theses USING btree (uploader_id);
CREATE INDEX idx_thesis_audience_user ON public.thesis_audience USING btree (user_id);

CREATE OR REPLACE FUNCTION public.enforce_signup_email_domain()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.is_friend(a text, b text)
 RETURNS boolean
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND least(f.requester_id, f.addressee_id) = least(a, b)
      AND greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.reject_audit_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.visible_posts(viewer text)
 RETURNS SETOF posts
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.visible_theses(viewer text)
 RETURNS SETOF theses
 LANGUAGE sql
 STABLE PARALLEL SAFE
AS $function$
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
$function$
;

CREATE TRIGGER admin_audit_log_append_only BEFORE DELETE OR UPDATE ON public.admin_audit_log FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER set_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_device_tokens_updated_at BEFORE UPDATE ON public.device_tokens FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_verification_updated_at BEFORE UPDATE ON public.profile_verification_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_theses_updated_at BEFORE UPDATE ON public.theses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "participants read conversations" ON public.conversations AS PERMISSIVE FOR SELECT TO authenticated USING (((user_a = (( SELECT auth.uid() AS uid))::text) OR (user_b = (( SELECT auth.uid() AS uid))::text)));
CREATE POLICY "participants read messages" ON public.messages AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.user_a = (( SELECT auth.uid() AS uid))::text) OR (c.user_b = (( SELECT auth.uid() AS uid))::text))))));
CREATE POLICY mfa_factors_owner ON public.mfa_factors AS PERMISSIVE FOR ALL TO PUBLIC USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "owners read notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = (( SELECT auth.uid() AS uid))::text));
CREATE POLICY session_events_read ON public.session_events AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_policy_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_audience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thesis_audience ENABLE ROW LEVEL SECURITY;

GRANT TRIGGER, REFERENCES, TRUNCATE, DELETE, UPDATE, SELECT, INSERT ON admin_audit_log TO service_role;
GRANT REFERENCES, INSERT, SELECT, UPDATE, DELETE, TRUNCATE, TRIGGER ON blocks TO service_role;
GRANT TRIGGER, REFERENCES, TRUNCATE, DELETE, UPDATE, SELECT, INSERT ON comments TO service_role;
GRANT TRIGGER, REFERENCES, TRUNCATE, SELECT, DELETE, UPDATE, INSERT ON conversation_state TO service_role;
GRANT SELECT ON conversations TO authenticated;
GRANT SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, INSERT ON conversations TO service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON courses TO service_role;
GRANT UPDATE, INSERT, TRIGGER, REFERENCES, TRUNCATE, DELETE, SELECT ON departments TO service_role;
GRANT REFERENCES, TRUNCATE, DELETE, UPDATE, SELECT, INSERT, TRIGGER ON device_tokens TO service_role;
GRANT DELETE, TRIGGER, REFERENCES, TRUNCATE, UPDATE, SELECT, INSERT ON friendships TO service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON likes TO service_role;
GRANT REFERENCES, INSERT, SELECT, UPDATE, DELETE, TRUNCATE, TRIGGER ON message_policy_departments TO service_role;
GRANT INSERT, SELECT, TRIGGER, REFERENCES, TRUNCATE, DELETE, UPDATE ON message_reports TO service_role;
GRANT SELECT ON messages TO authenticated;
GRANT SELECT, UPDATE, TRIGGER, REFERENCES, TRUNCATE, DELETE, INSERT ON messages TO service_role;
GRANT INSERT, TRIGGER, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES ON mfa_factors TO service_role;
GRANT SELECT ON notifications TO authenticated;
GRANT TRIGGER, INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES ON notifications TO service_role;
GRANT INSERT, TRIGGER, REFERENCES, TRUNCATE, DELETE, UPDATE, SELECT ON pending_signups TO service_role;
GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON post_audience TO service_role;
GRANT TRIGGER, REFERENCES, TRUNCATE, DELETE, UPDATE, SELECT, INSERT ON posts TO service_role;
GRANT TRIGGER, REFERENCES, TRUNCATE, DELETE, UPDATE, SELECT, INSERT ON profile_verification_requests TO service_role;
GRANT TRIGGER, REFERENCES, TRUNCATE, DELETE, UPDATE, SELECT, INSERT ON profiles TO service_role;
GRANT INSERT, TRIGGER, REFERENCES, TRUNCATE, DELETE, UPDATE, SELECT ON session_events TO service_role;
GRANT TRIGGER, INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES ON theses TO service_role;
GRANT INSERT, TRIGGER, REFERENCES, TRUNCATE, DELETE, UPDATE, SELECT ON thesis_audience TO service_role;

