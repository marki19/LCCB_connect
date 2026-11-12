-- 040_content_visibility_announcement.sql
--
-- A new enum value cannot be used in the transaction that adds it, so this file
-- contains nothing else. The functions and columns that reference 'announcement'
-- live in 041_announcement_posts.sql, which runs as its own transaction.
ALTER TYPE public.content_visibility ADD VALUE IF NOT EXISTS 'announcement';
