-- 008_profiles_presence.sql
--
-- Presence lives on `profiles` (Messaging_plan.md §1, §8):
--   * `presence_mode`     — the mode the user selected (online/away/busy/dnd/invisible)
--   * `last_seen_at`      — throttled heartbeat (60 s) + on background
--   * `last_seen_visible` — opt-in; `last_seen_at` is exposed only when true
--
-- Idempotent. Apply with:
--   node scripts/run-sql.js migrations/008_profiles_presence.sql

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS presence_mode TEXT NOT NULL DEFAULT 'online'
    CHECK (presence_mode IN ('online', 'away', 'busy', 'dnd', 'invisible')),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_visible BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
