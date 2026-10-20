const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../db");

async function applyWebsiteMigration() {
  const sql = `
    -- 1. Add preview_metadata column to posts (for title, description, image, live url)
    ALTER TABLE public.posts
      ADD COLUMN IF NOT EXISTS preview_metadata JSONB;

    -- 2. Update type CHECK constraint to include 'website'
    ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_type_check;
    ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS chk_posts_type;
    ALTER TABLE public.posts ADD CONSTRAINT posts_type_check
      CHECK (type IN ('text', 'image', 'project', 'capstone', 'website'));
  `;
  try {
    console.log("Applying website environment migration (raw SQL)...");
    await db.query(sql);
    console.log("Website environment migration applied successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

applyWebsiteMigration();
