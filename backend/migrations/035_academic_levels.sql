-- Migration 035: Academic Levels table
-- Allows customizable year levels (1st Year, 2nd Year, IBED, Integrated Studies, etc.)

CREATE TABLE IF NOT EXISTS public.academic_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default academic levels
INSERT INTO public.academic_levels (name, code, sort_order) VALUES
  ('1st Year', '1ST_YEAR', 1),
  ('2nd Year', '2ND_YEAR', 2),
  ('3rd Year', '3RD_YEAR', 3),
  ('4th Year', '4TH_YEAR', 4),
  ('5th Year', '5TH_YEAR', 5),
  ('IBED', 'IBED', 6),
  ('Integrated Studies', 'INTEGRATED_STUDIES', 7)
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.academic_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active academic levels" ON public.academic_levels;
CREATE POLICY "Public can read active academic levels"
  ON public.academic_levels
  FOR SELECT
  USING (active = true);

