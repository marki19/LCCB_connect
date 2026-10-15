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
  role TEXT DEFAULT 'student',
  skills TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'project', 'capstone')),
  title TEXT,
  technologies TEXT[],
  github_url TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Theses table
CREATE TABLE IF NOT EXISTS public.theses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uploader_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  department TEXT NOT NULL,
  category TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_theses_uploader ON public.theses(uploader_id);
CREATE INDEX IF NOT EXISTS idx_theses_created_at ON public.theses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_post ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments(post_id);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for posts" ON public.posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for theses" ON public.theses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for likes" ON public.likes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for comments" ON public.comments FOR ALL USING (true) WITH CHECK (true);
