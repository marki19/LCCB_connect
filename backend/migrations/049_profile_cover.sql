-- 049_profile_cover.sql
--
-- Adds cover_url to public.profiles for Facebook-style banner cover photos.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url TEXT;
