-- 013_domain_lockdown.sql
--
-- Restricts account creation to @lccbonline.edu.ph addresses at the database,
-- so the client-side check in register.tsx cannot be bypassed by calling
-- POST /auth/v1/signup directly with the public anon key.
--
-- The Free plan does not expose the `before-user-created` auth hook, so this is
-- a trigger on auth.users instead. It runs inside Supabase Auth's own insert
-- transaction: raising here aborts the signup and no user row is written.
--
-- Google OAuth signups carry the same email, so they are covered too.

CREATE OR REPLACE FUNCTION public.enforce_signup_email_domain()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed_domain CONSTANT text := 'lccbonline.edu.ph';
  email_domain text;
BEGIN
  -- Phone-only and anonymous signups carry no email and are not part of this
  -- product's flow; an email rule must not reject them for the wrong reason.
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  email_domain := lower(split_part(NEW.email, '@', 2));

  IF email_domain <> allowed_domain THEN
    RAISE EXCEPTION 'Signups are restricted to % addresses', allowed_domain
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Only Supabase Auth may execute this; the trigger fires in its transaction.
REVOKE ALL ON FUNCTION public.enforce_signup_email_domain() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_signup_email_domain() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS enforce_signup_email_domain ON auth.users;
CREATE TRIGGER enforce_signup_email_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_signup_email_domain();
