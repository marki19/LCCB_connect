// Deterministic environment for the test suite. Must be required BEFORE
// `../app.js` — the app reads these at load time.
//
// These are throwaway values: no test contacts Supabase or Postgres (the
// Supabase token check and every model function are stubbed).
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon-key";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/test";

// Effectively disable rate limiting so the suite can exercise the routes.
process.env.RATE_LIMIT_MAX = "1000000";
process.env.RATE_LIMIT_WRITE_MAX = "1000000";
process.env.RATE_LIMIT_SEND_MAX = "1000000";
process.env.RATE_LIMIT_SEND_DAILY_MAX = "1000000";
process.env.RATE_LIMIT_FRIEND_MAX = "1000000";
process.env.RATE_LIMIT_REPORT_MAX = "1000000";
