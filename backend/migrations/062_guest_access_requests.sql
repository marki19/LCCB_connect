-- ============================================================================
-- Migration 062: Guest / Outsider Access Requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.guest_access_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  affiliation_type text NOT NULL CHECK (affiliation_type IN ('student_elsewhere','faculty_elsewhere','professional','researcher','other')),
  affiliation_name text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by text REFERENCES public.profiles(id),
  decision_note text,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_guest_access_status_submitted
  ON public.guest_access_requests (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_access_user
  ON public.guest_access_requests (user_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guest_declared_at timestamptz,
  ADD COLUMN IF NOT EXISTS guest_purpose text,
  ADD COLUMN IF NOT EXISTS guest_affiliation_type text,
  ADD COLUMN IF NOT EXISTS guest_affiliation_name text,
  ADD COLUMN IF NOT EXISTS guest_location text;

ALTER TABLE public.guest_access_requests ENABLE ROW LEVEL SECURITY;
