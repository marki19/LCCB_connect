-- 026_create_reports_table.sql
-- Reports table with UNIQUE constraint to prevent spam

BEGIN;

-- ---- 1. Create report_reason enum -------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason') THEN
    CREATE TYPE public.report_reason AS ENUM (
      'spam',
      'harassment',
      'inappropriate',
      'misinformation',
      'copyright',
      'other'
    );
  END IF;
END $$;

-- ---- 2. Create reports table ------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'repost', 'comment', 'thesis', 'message', 'profile')),
  target_id UUID NOT NULL,
  reason public.report_reason NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reports_unique_reporter_target UNIQUE (reporter_id, target_type, target_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_target
  ON public.reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter
  ON public.reports (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status
  ON public.reports (status, created_at);

-- RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Reporter can read their own reports
CREATE POLICY "reports_read_own" ON public.reports
  FOR SELECT
  USING (reporter_id = current_setting('request.jwt.claim.sub', true)::text);

-- Anyone authenticated can create a report (dedup enforced by UNIQUE)
CREATE POLICY "reports_insert_authenticated" ON public.reports
  FOR INSERT
  WITH CHECK (reporter_id = current_setting('request.jwt.claim.sub', true)::text);

-- Admin policies (campus_admin, department_admin, super_admin)
CREATE POLICY "reports_admin_read_all" ON public.reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = current_setting('request.jwt.claim.sub', true)::text
        AND p.role IN ('campus_admin', 'department_admin', 'super_admin')
    )
  );

CREATE POLICY "reports_admin_update_status" ON public.reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = current_setting('request.jwt.claim.sub', true)::text
        AND p.role IN ('campus_admin', 'department_admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = current_setting('request.jwt.claim.sub', true)::text
        AND p.role IN ('campus_admin', 'department_admin', 'super_admin')
    )
  );

COMMIT;