-- Migration 051: Add social/contact links and personal details to profiles table

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS facebook_url VARCHAR(255),
  ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(255),
  ADD COLUMN IF NOT EXISTS twitter_url VARCHAR(255),
  ADD COLUMN IF NOT EXISTS relationship_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
