const db = require("../db");

async function migrate() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.likes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS public.comments (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read-write for likes') THEN
        CREATE POLICY "Allow public read-write for likes" ON public.likes FOR ALL USING (true) WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read-write for comments') THEN
        CREATE POLICY "Allow public read-write for comments" ON public.comments FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END
    $$;
  `;

  await db.query(sql);
  console.log("Migration complete: likes and comments tables created with raw SQL.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
