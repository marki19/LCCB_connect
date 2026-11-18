-- Migration 050: Profile Notes (Instagram/Facebook-style status notes over avatar)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS note VARCHAR(60) DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMPTZ DEFAULT NULL;
