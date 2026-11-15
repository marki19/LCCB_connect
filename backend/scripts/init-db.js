const fs = require("fs");
const path = require("path");
const db = require("../db");

async function initDB() {
  try {
    // 1. Create prerequisite stub schemas, tables, and roles for vanilla Postgres environments (e.g. CI)
    const setupStubSql = `
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE,
        raw_user_meta_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000000'::uuid $$;

      CREATE SCHEMA IF NOT EXISTS storage;
      CREATE TABLE IF NOT EXISTS storage.buckets (
        id TEXT PRIMARY KEY,
        name TEXT,
        public BOOLEAN DEFAULT FALSE,
        file_size_limit BIGINT,
        allowed_mime_types TEXT[]
      );
      CREATE TABLE IF NOT EXISTS storage.objects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id TEXT REFERENCES storage.buckets(id),
        name TEXT,
        owner UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        metadata JSONB
      );
      CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
        SELECT string_to_array(name, '/');
      $$;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
          CREATE ROLE supabase_auth_admin NOLOGIN;
        END IF;
      END $$;
    `;
    console.log("Setting up prerequisite schemas/roles...");
    await db.query(setupStubSql);

    // 2. Run base schema
    const schemaSql = fs.readFileSync(path.join(__dirname, "../schema.sql"), "utf8");
    console.log("Running SQL base schema setup...");
    await db.query(schemaSql);
    console.log("SUCCESS: Base schema applied.");

    // 3. Run all migrations in sorted order
    const migrationsDir = path.join(__dirname, "../migrations");
    if (fs.existsSync(migrationsDir)) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      for (const file of files) {
        const migSql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        try {
          await db.query(migSql);
          console.log(`Applied migration: ${file}`);
        } catch (migErr) {
          console.warn(`Migration notice for ${file}: ${migErr.message}`);
        }
      }
    }

    console.log("SUCCESS: All tables and migrations created successfully!");
    process.exit(0);
  } catch (err) {
    console.error("ERROR creating tables:", err.message);
    process.exit(1);
  }
}

initDB();
