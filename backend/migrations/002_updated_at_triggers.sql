-- 002_updated_at_triggers.sql
--
-- Keep `updated_at` authoritative on the server. Without this, a client could
-- send any `updated_at` value (there is no column-level guard) and the row's
-- modification time would be forgeable. The trigger always overwrites it.
--
-- Idempotent: safe to run repeatedly.
-- Apply with:  node scripts/run-sql.js migrations/002_updated_at_triggers.sql

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_posts_updated_at ON public.posts;
CREATE TRIGGER set_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_theses_updated_at ON public.theses;
CREATE TRIGGER set_theses_updated_at
  BEFORE UPDATE ON public.theses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
