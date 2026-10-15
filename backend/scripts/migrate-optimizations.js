const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function applyOptimizations() {
  const sql = `
    -- 1. Indexes on foreign keys and sort columns for fast reads
    CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_theses_uploader ON public.theses(uploader_id);
    CREATE INDEX IF NOT EXISTS idx_theses_created_at ON public.theses(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_likes_post ON public.likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments(post_id);

    -- 2. Add updated_at timestamps
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.theses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    -- 3. Constraints
    DO $$
    BEGIN
      -- Post type constraint (text, image, project, capstone)
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_posts_type'
      ) THEN
        ALTER TABLE public.posts 
        ADD CONSTRAINT chk_posts_type 
        CHECK (type IN ('text', 'image', 'project', 'capstone'));
      END IF;

      -- Profile username unique constraint (if not already unique)
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_profiles_username'
      ) THEN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key'
        ) THEN
          ALTER TABLE public.profiles ADD CONSTRAINT unique_profiles_username UNIQUE (username);
        END IF;
      END IF;
    END
    $$;
  `;

  await db.query(sql);
  console.log("Database optimizations applied successfully via raw SQL.");
  process.exit(0);
}

applyOptimizations().catch((err) => {
  console.error("Optimization migration failed:", err);
  process.exit(1);
});
