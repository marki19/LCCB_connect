-- =============================================================================
-- LCCB Connect - Canonical Unified Database Schema
-- Compatible with standard PostgreSQL 14+ (Local Linux / On-Premise / Docker)
-- =============================================================================

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EXCEPTION WHEN OTHERS THEN
  -- gen_random_uuid() is built-in on PostgreSQL 13+
  NULL;
END $$;

-- ─── 0. Trigger Helper ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 1. Migration Version Tracking Table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public._migrations (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Academic Catalog & Levels ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_departments_active ON public.departments(is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  code TEXT,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_courses_department_name UNIQUE (department_id, name)
);
CREATE INDEX IF NOT EXISTS idx_courses_department ON public.courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_active ON public.courses(is_active, sort_order);

CREATE TABLE IF NOT EXISTS public.academic_levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. Profiles & Authentication ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  course TEXT,
  year_level TEXT,
  role TEXT DEFAULT 'user' CHECK (
    role IN (
      'user', 'student', 'faculty', 'departmentAdmin', 'department_admin',
      'admin', 'superadmin', 'superAdmin'
    )
  ),
  skills TEXT[],
  email TEXT,
  student_id TEXT,
  password_hash TEXT,
  email_confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified')),
  verified_at TIMESTAMPTZ,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  message_policy TEXT NOT NULL DEFAULT 'department'
    CHECK (message_policy IN ('everyone', 'department', 'selected', 'nobody')),
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  profile_banner_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  suspended_until TIMESTAMPTZ,
  suspension_reason TEXT,
  suspended_by TEXT,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  email_bounced BOOLEAN NOT NULL DEFAULT FALSE,
  bounce_reason TEXT,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT profiles_suspension_dates_check CHECK (suspended_until IS NULL OR suspended_at IS NOT NULL),
  CONSTRAINT chk_profiles_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9._]{3,30}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username_lower
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_student_id
  ON public.profiles (upper(student_id))
  WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_course ON public.profiles(course_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_role_norm ON public.profiles (lower(replace(replace(role, '-', ''), '_', '')));

-- Refresh Tokens (Native Auth Session Lifecycle)
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON public.refresh_tokens (expires_at);

-- Verification Requests
CREATE TABLE IF NOT EXISTS public.profile_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  full_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  course_id UUID REFERENCES public.courses(id),
  year_level TEXT,
  birthdate DATE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_verification_role_shape CHECK (
    role = ANY (ARRAY['student','faculty','departmentAdmin','admin'])
    AND (
      (
        role = 'student'
        AND department_id IS NOT NULL
        AND course_id IS NOT NULL
        AND year_level IS NOT NULL
      )
      OR (
        role = ANY (ARRAY['faculty','departmentAdmin'])
        AND department_id IS NOT NULL
        AND course_id IS NULL
        AND year_level IS NULL
      )
      OR (
        role = 'admin'
        AND department_id IS NULL
        AND course_id IS NULL
        AND year_level IS NULL
      )
    )
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_verification_one_pending
  ON public.profile_verification_requests (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_verification_status
  ON public.profile_verification_requests (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_escalated
  ON public.profile_verification_requests (escalated_at) WHERE escalated_at IS NOT NULL;

-- Verification OTPs (for faculty/admin invites)
CREATE TABLE IF NOT EXISTS public.verification_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_role TEXT NOT NULL CHECK (target_role IN ('faculty', 'department_admin', 'admin', 'superadmin')),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verification_otp_user ON public.verification_otp(user_id);

-- Pending signups (Pre-OTP registration)
CREATE TABLE IF NOT EXISTS public.pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  otp_expires_at TIMESTAMPTZ NOT NULL,
  otp_attempts INT NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON public.pending_signups (lower(email));

-- Password resets
CREATE TABLE IF NOT EXISTS public.password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  otp_expires_at TIMESTAMPTZ NOT NULL,
  otp_attempts INT NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON public.password_resets (lower(email));

-- Multi-Factor Authentication (TOTP)
CREATE TABLE IF NOT EXISTS public.mfa_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'totp' CHECK (type IN ('totp')),
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'verified')),
  secret TEXT NOT NULL,
  last_used_step BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mfa_factors_user ON public.mfa_factors(user_id);

-- Session events & audit tracking
CREATE TABLE IF NOT EXISTS public.session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('login', 'mfa_challenge', 'logout', 'force_signout')),
  aal TEXT NOT NULL DEFAULT 'aal1' CHECK (aal IN ('aal1', 'aal2')),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_events_user ON public.session_events(user_id, created_at DESC);

-- ─── 4. Posts, Theses, and Content ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'general' CHECK (type IN ('general', 'capstone', 'project', 'image', 'announcement')),
  image_url TEXT,
  image_urls TEXT[],
  technologies TEXT[],
  github_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'department', 'course', 'year_level', 'role')),
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  hidden_at TIMESTAMPTZ,
  hidden_reason TEXT,
  hidden_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON public.posts(visibility);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.post_audience (
  post_id UUID PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  year_level TEXT,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.theses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  department TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  tags TEXT[],
  keywords TEXT[],
  pdf_url TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'department', 'course', 'year_level', 'role')),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden', 'deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_theses_uploader ON public.theses(uploader_id);
CREATE INDEX IF NOT EXISTS idx_theses_department ON public.theses(department_id);
CREATE INDEX IF NOT EXISTS idx_theses_status ON public.theses(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.thesis_audience (
  thesis_id UUID PRIMARY KEY REFERENCES public.theses(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  year_level TEXT,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments & Likes
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  thesis_id UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_thesis ON public.comments(thesis_id);

CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  thesis_id UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_likes_post UNIQUE (user_id, post_id),
  CONSTRAINT uq_likes_thesis UNIQUE (user_id, thesis_id)
);

CREATE TABLE IF NOT EXISTS public.reposts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_reposts_user_post UNIQUE (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_reposts_post ON public.reposts(post_id);
CREATE INDEX IF NOT EXISTS idx_reposts_user ON public.reposts(user_id);

-- Saved bookmarks & collections
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  thesis_id UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_saved_post UNIQUE (user_id, post_id),
  CONSTRAINT uq_saved_thesis UNIQUE (user_id, thesis_id)
);

CREATE TABLE IF NOT EXISTS public.saved_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.saved_collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.saved_collections(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  thesis_id UUID REFERENCES public.theses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. Messaging & Social Graph ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_friendships_pair UNIQUE (user_id, friend_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON public.friendships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON public.friendships(friend_id, status);

CREATE TABLE IF NOT EXISTS public.message_policy_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_mpd_pair UNIQUE (user_id, department_id)
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  title TEXT,
  created_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  participant_ids TEXT[] NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations USING GIN (participant_ids);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON public.conversations (last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT,
  attachment_url TEXT,
  attachment_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.conversation_state (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ,
  unread_count INT NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.device_tokens (
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, token)
);

CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_blocks_pair UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks(blocked_id);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'thesis', 'comment', 'user', 'message')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);

-- Governance & Audit
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON public.admin_audit_log(created_at DESC);

-- ─── 6. Automatic Triggers ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_departments_updated_at ON public.departments;
CREATE TRIGGER set_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_courses_updated_at ON public.courses;
CREATE TRIGGER set_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_posts_updated_at ON public.posts;
CREATE TRIGGER set_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_theses_updated_at ON public.theses;
CREATE TRIGGER set_theses_updated_at
  BEFORE UPDATE ON public.theses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 7. Pre-seed Default Departments & Courses ───────────────────────────────
INSERT INTO public.departments (id, code, name, sort_order) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'CCS', 'College of Computer Studies', 1),
  ('d2222222-2222-2222-2222-222222222222', 'CBA', 'College of Business and Accountancy', 2),
  ('d3333333-3333-3333-3333-333333333333', 'CAS', 'College of Arts and Sciences', 3),
  ('d4444444-4444-4444-4444-444444444444', 'CHM', 'College of Hospitality Management', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.courses (id, department_id, code, name, sort_order) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'BSIT', 'BS Information Technology', 1),
  ('c2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'BSCS', 'BS Computer Science', 2),
  ('c3333333-3333-3333-3333-333333333333', 'd1111111-1111-1111-1111-111111111111', 'BSIS', 'BS Information Systems', 3),
  ('c4444444-4444-4444-4444-444444444444', 'd2222222-2222-2222-2222-222222222222', 'BSA', 'BS Accountancy', 4),
  ('c5555555-5555-5555-5555-555555555555', 'd2222222-2222-2222-2222-222222222222', 'BSBA', 'BS Business Administration', 5)
ON CONFLICT (id) DO NOTHING;

-- Pre-seed migration version records 001 through 045 so the migration runner
-- knows all baseline migrations are present.
INSERT INTO public._migrations (name) VALUES
  ('001_rls_hardening.sql'),
  ('002_updated_at_triggers.sql'),
  ('003_profiles_role_check.sql'),
  ('004_departments_courses.sql'),
  ('005_department_scope.sql'),
  ('006_messaging_core.sql'),
  ('007_realtime_policies.sql'),
  ('008_profiles_presence.sql'),
  ('009_schema_reconciliation.sql'),
  ('010_superadmin_console.sql'),
  ('011_storage_buckets.sql'),
  ('012_storage_size_limits.sql'),
  ('013_domain_lockdown.sql'),
  ('014_content_visibility.sql'),
  ('015_storage_private_buckets.sql'),
  ('016_identity_verification.sql'),
  ('017_verification_birthdate.sql'),
  ('018_pending_signups.sql'),
  ('019_mfa.sql'),
  ('020_account_lockout.sql'),
  ('021_email_bounce_tracking.sql'),
  ('022_otp_hashing.sql'),
  ('023_totp_replay_guard.sql'),
  ('024_alter_posts_reposts_visibility.sql'),
  ('025_create_reposts_table.sql'),
  ('026_create_reports_table.sql'),
  ('027_create_blocks_table.sql'),
  ('028_alter_profiles_banner_complete.sql'),
  ('029_alter_notifications_repost.sql'),
  ('030_alter_friendships_rls.sql'),
  ('031_saved_posts_and_search_indexes.sql'),
  ('032_visible_reposts_function.sql'),
  ('033_post_multi_images.sql'),
  ('034_saved_collections.sql'),
  ('035_academic_levels.sql'),
  ('036_department_post_visibility.sql'),
  ('037_create_password_resets.sql'),
  ('038_mfa_grants_and_cache_reload.sql'),
  ('039_prune_message_notifications.sql'),
  ('040_content_visibility_announcement.sql'),
  ('041_announcement_posts.sql'),
  ('042_verification_roles.sql'),
  ('043_profiles_role_norm_index.sql'),
  ('044_friendship_suggestions.sql'),
  ('045_native_auth.sql'),
  ('046_refresh_tokens.sql'),
  ('047_user_role.sql')
ON CONFLICT (name) DO NOTHING;
