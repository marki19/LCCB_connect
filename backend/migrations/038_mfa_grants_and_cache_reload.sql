-- 038_mfa_grants_and_cache_reload.sql
-- Ensure service_role and postgres roles have full access to mfa_factors and session_events,
-- ensure last_used_step exists, and notify PostgREST to reload its schema cache.

ALTER TABLE public.mfa_factors
  ADD COLUMN IF NOT EXISTS last_used_step BIGINT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE public.mfa_factors TO service_role;
    GRANT ALL ON TABLE public.session_events TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    GRANT ALL ON TABLE public.mfa_factors TO postgres;
    GRANT ALL ON TABLE public.session_events TO postgres;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

