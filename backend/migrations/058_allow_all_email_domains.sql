-- 058_allow_all_email_domains.sql
-- Allow external users (e.g. Gmail) to register and log in while keeping
-- institutional verification locked to @lccbonline.edu.ph in application policy.

DROP TRIGGER IF EXISTS enforce_signup_email_domain ON auth.users;
DROP FUNCTION IF EXISTS public.enforce_signup_email_domain();
