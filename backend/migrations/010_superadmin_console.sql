-- 010_superadmin_console.sql
-- Foundation for the superadmin console: account suspension + append-only
-- governance audit log. Idempotent; safe to re-run.

-- ---- account suspension ----------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_by TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_suspension_dates_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_suspension_dates_check
      CHECK (suspended_until IS NULL OR suspended_at IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_suspended
  ON public.profiles(suspended_at)
  WHERE suspended_at IS NOT NULL;

-- ---- append-only audit log -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_username TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_label TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON public.admin_audit_log(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor
  ON public.admin_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action
  ON public.admin_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target
  ON public.admin_audit_log(target_type, target_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON public.admin_audit_log FROM %I', r);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.reject_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_log_append_only ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_append_only
BEFORE UPDATE OR DELETE ON public.admin_audit_log
FOR EACH ROW EXECUTE FUNCTION public.reject_audit_mutation();

COMMENT ON TABLE public.admin_audit_log IS
  'Append-only record of privileged console actions. Rows outlive actors and targets.';
