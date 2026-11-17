-- Migration 052: Permanent Identity & Username Integrity Backfill
--
-- 1. Backfill full_name where missing or blank.
-- 2. Backfill username for all profiles where null with unique, sanitized handle:
--    [a-z0-9._]{3,30}, collision suffixing (_2, _3).
-- 3. Create case-insensitive unique index on lower(username).
-- 4. Enforce format check constraint on profiles.username.

-- 1. Backfill missing full_name
UPDATE public.profiles
SET full_name = COALESCE(
  NULLIF(split_part(email, '@', 1), ''),
  'Student ' || right(regexp_replace(id::text, '[^a-zA-Z0-9]', '', 'g'), 6)
)
WHERE full_name IS NULL OR trim(full_name) = '';

-- 2. Backfill missing usernames
DO $$
DECLARE
  r RECORD;
  raw_name TEXT;
  name_parts TEXT[];
  candidate TEXT;
  base_candidate TEXT;
  counter INT;
  suffix TEXT;
  max_base_len INT;
  id_suffix TEXT;
BEGIN
  FOR r IN SELECT id, full_name, email FROM public.profiles WHERE username IS NULL ORDER BY id ASC LOOP
    candidate := NULL;
    raw_name := trim(r.full_name);
    
    IF raw_name IS NOT NULL AND length(raw_name) > 0 THEN
      name_parts := regexp_split_to_array(raw_name, '\s+');
      IF array_length(name_parts, 1) = 1 THEN
        candidate := name_parts[1];
      ELSIF array_length(name_parts, 1) = 2 THEN
        candidate := name_parts[1] || '.' || name_parts[2];
      ELSIF array_length(name_parts, 1) > 2 THEN
        candidate := name_parts[1] || '.' || array_to_string(name_parts[2:array_length(name_parts, 1)], '');
      END IF;
    END IF;

    -- Sanitize handle: translate diacritics, lowercase, strip invalid chars, collapse dots, trim dots
    IF candidate IS NOT NULL THEN
      candidate := lower(translate(candidate, 'áàâãäéèêëíìîïóòôõöúùûüñç', 'aaaaaeeeeiiiiooooouuuunc'));
      candidate := regexp_replace(candidate, '[^a-z0-9.]', '', 'g');
      candidate := regexp_replace(candidate, '\.+', '.', 'g');
      candidate := regexp_replace(regexp_replace(candidate, '^\.+', ''), '\.+$', '');
      candidate := substr(candidate, 1, 30);
    END IF;

    -- Fallback if candidate is null or shorter than 3 chars
    IF candidate IS NULL OR length(candidate) < 3 THEN
      id_suffix := right(regexp_replace(r.id::text, '[^a-zA-Z0-9]', '', 'g'), 6);
      IF length(id_suffix) < 6 THEN
        id_suffix := rpad(id_suffix, 6, '0');
      END IF;
      candidate := substr(lower('student' || id_suffix), 1, 30);
    END IF;

    base_candidate := candidate;
    counter := 2;

    -- Resolve collisions
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(candidate) AND id != r.id) LOOP
      suffix := '_' || counter::text;
      max_base_len := 30 - length(suffix);
      candidate := substr(base_candidate, 1, max_base_len) || suffix;
      counter := counter + 1;
    END LOOP;

    UPDATE public.profiles SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- 3. Case-insensitive unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username_lower
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- 4. Username format check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_username_format'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT chk_profiles_username_format
      CHECK (username IS NULL OR username ~ '^[a-z0-9._]{3,30}$');
  END IF;
END $$;
