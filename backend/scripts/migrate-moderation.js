const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function applyModerationMigration() {
  const sql = `
    -- 1. Add moderation columns to posts
    ALTER TABLE public.posts 
      ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved',
      ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

    -- 2. Add moderation columns to comments
    ALTER TABLE public.comments 
      ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved',
      ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

    -- 3. Add moderation columns to theses
    ALTER TABLE public.theses 
      ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved',
      ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

    -- 4. Constraint on moderation_status
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_posts_moderation') THEN
        ALTER TABLE public.posts ADD CONSTRAINT chk_posts_moderation 
          CHECK (moderation_status IN ('approved', 'flagged', 'hidden'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_comments_moderation') THEN
        ALTER TABLE public.comments ADD CONSTRAINT chk_comments_moderation 
          CHECK (moderation_status IN ('approved', 'flagged', 'hidden'));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_theses_moderation') THEN
        ALTER TABLE public.theses ADD CONSTRAINT chk_theses_moderation 
          CHECK (moderation_status IN ('approved', 'flagged', 'hidden'));
      END IF;
    END
    $$;

    -- 5. Notifications table (Raw SQL)
    CREATE TABLE IF NOT EXISTS public.notifications (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      actor_id TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      target_id UUID,
      department TEXT,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 6. Indexes for moderation and notifications
    CREATE INDEX IF NOT EXISTS idx_posts_moderation ON public.posts(moderation_status);
    CREATE INDEX IF NOT EXISTS idx_comments_moderation ON public.comments(moderation_status);
    CREATE INDEX IF NOT EXISTS idx_theses_moderation ON public.theses(moderation_status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_notifications_dept ON public.notifications(department);

    -- 7. Row Level Security for notifications
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read-write for notifications') THEN
        CREATE POLICY "Allow public read-write for notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END
    $$;
  `;

  await db.query(sql);
  console.log("Moderation and notifications migration complete via raw SQL.");
  process.exit(0);
}

applyModerationMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
