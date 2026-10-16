-- ============================================================================
-- Phase 3 — RLS hardening
-- ============================================================================
-- Why
--   The Expo app never reads/writes these tables through Supabase PostgREST;
--   all data access goes through the Express API, which connects as the table
--   owner (`postgres` via the pooler) and therefore bypasses RLS. Meanwhile the
--   public `anon` key (shipped in the app and leaked via git) had full
--   read/write on every table through the decorative `USING (true)` policies.
--   This migration closes that public path.
--
-- Safety
--   * The API keeps working: the connection role is the table owner, which
--     bypasses RLS.
--   * Do NOT add `ALTER TABLE ... FORCE ROW LEVEL SECURITY` here. That would
--     also subject the owner (the API) to RLS and break the backend. If you ever
--     move the API to a non-owner role, add explicit policies for that role
--     first.
--   * Storage objects are governed by Storage RLS, not this migration.
--
-- Idempotent: safe to run more than once.
-- Run with:  node scripts/run-sql.js migrations/001_rls_hardening.sql
-- ============================================================================

-- 1. Drop the decorative blanket policies (deny-by-default once removed).
DROP POLICY IF EXISTS "Allow public read-write for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read-write for posts"    ON public.posts;
DROP POLICY IF EXISTS "Allow public read-write for theses"   ON public.theses;
DROP POLICY IF EXISTS "Allow public read-write for likes"    ON public.likes;
DROP POLICY IF EXISTS "Allow public read-write for comments" ON public.comments;

-- 2. Ensure RLS is enabled on every table.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 3. Revoke the public Supabase API roles' access to these tables.
--    (These roles exist on Supabase; the guard keeps the script portable and
--    re-runnable on a plain Postgres.)
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON public.profiles, public.posts, public.theses, public.likes, public.comments FROM %I',
        r
      );
    END IF;
  END LOOP;
END $$;

-- 4. Prevent future tables in `public` from being auto-exposed to the anon key.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
    END IF;
  END LOOP;
END $$;

-- 5. (Optional) If you later want the anon key to READ the public feed only,
--    add narrow SELECT-only policies instead of the old blanket ALL policies:
--
--      CREATE POLICY posts_public_read ON public.posts
--        FOR SELECT TO anon, authenticated USING (true);
--
--    Repeat per table as needed (profiles/theses/likes/comments).
