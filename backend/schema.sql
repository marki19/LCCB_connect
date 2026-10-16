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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
    CHECK (message_policy IN ('everyone', 'department', 'selected', 'nobody'));

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
        'REVOKE ALL ON public.profiles, public.posts, public.theses, public.likes, public.comments, public.notifications, public.departments, public.courses FROM %I',
        r
      );
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
    END IF;
  END LOOP;
END $$;

-- Upgrading an existing database? Apply migrations/001_rls_hardening.sql instead.
