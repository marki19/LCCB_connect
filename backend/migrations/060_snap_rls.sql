-- 060_snap_rls.sql
-- Close the last three tables in `public` that had RLS disabled.
--
-- Why
--   Migration 059 created `snaps`, `snap_views`, and `snap_reactions` without
--   enabling row-level security, making them the only OPEN tables in the
--   schema. They are currently unreachable from the public Supabase API only
--   because `anon` and `authenticated` hold no table privileges (see
--   001_rls_hardening.sql). That is a single accidental GRANT away from every
--   snap in the school being readable with the anon key that ships in the app.
--
-- Posture
--   Deny-by-default, like the rest of the schema: RLS enabled, no policies.
--   All snap traffic goes through the Express API, which connects as the table
--   owner and therefore bypasses RLS.
--
--   Deliberately no `FOR SELECT` policy yet. The obvious one —
--   `USING (id IN (SELECT id FROM public.visible_snaps(auth.uid()::text)))` —
--   would recurse: `visible_snaps` is SECURITY INVOKER, so RLS on `snaps`
--   would apply to the function's own query. If Supabase-direct reads are ever
--   wanted, mark `visible_snaps` SECURITY DEFINER first, then add the policy.
--
-- Idempotent: safe to run more than once.
-- Run with:  node scripts/migrate.js

BEGIN;

ALTER TABLE public.snaps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snap_views     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snap_reactions ENABLE ROW LEVEL SECURITY;

-- Defence in depth: revoke the public API roles if a previous grant exists.
-- The guard keeps the script portable and re-runnable on a plain Postgres.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON public.snaps, public.snap_views, public.snap_reactions FROM %I',
        r
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
