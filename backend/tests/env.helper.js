// Deterministic environment for the test suite. Must be required BEFORE
// `../app.js` — the app reads these at load time.
//
// These are throwaway values: no test contacts Supabase or Postgres (the
// Supabase token check and every model function are stubbed).
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://test-project.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role-key";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgrespassword@127.0.0.1:5432/lcc_connect_test";

// Signup codes are stored as HMAC(email:code, OTP_PEPPER). The suite needs a
// fixed pepper so fixtures can compute the hash the endpoint will compare.
process.env.OTP_PEPPER = process.env.OTP_PEPPER || "test-otp-pepper-value-0123456789";

// MFA challenge tokens are HMAC-signed. A fixed test secret keeps tokens
// deterministic across the suite.
process.env.MFA_CHALLENGE_SECRET =
  process.env.MFA_CHALLENGE_SECRET || "test-mfa-challenge-secret-0123456789";

// Effectively disable rate limiting so the suite can exercise the routes.
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || "1000000";
process.env.RATE_LIMIT_WRITE_MAX = process.env.RATE_LIMIT_WRITE_MAX || "1000000";
process.env.RATE_LIMIT_SEND_MAX = process.env.RATE_LIMIT_SEND_MAX || "1000000";
process.env.RATE_LIMIT_FRIEND_MAX = process.env.RATE_LIMIT_FRIEND_MAX || "1000000";
process.env.RATE_LIMIT_REPORT_MAX = process.env.RATE_LIMIT_REPORT_MAX || "1000000";
process.env.RATE_LIMIT_MFA_CHALLENGE_MAX = process.env.RATE_LIMIT_MFA_CHALLENGE_MAX || "1000000";
process.env.RATE_LIMIT_POST_MAX = process.env.RATE_LIMIT_POST_MAX || "1000000";
process.env.RATE_LIMIT_POST_DAILY_MAX = process.env.RATE_LIMIT_POST_DAILY_MAX || "1000000";
process.env.RATE_LIMIT_REPOST_MAX = process.env.RATE_LIMIT_REPOST_MAX || "1000000";
process.env.RATE_LIMIT_REPOST_DAILY_MAX = process.env.RATE_LIMIT_REPOST_DAILY_MAX || "1000000";
process.env.RATE_LIMIT_COMMENT_MAX = process.env.RATE_LIMIT_COMMENT_MAX || "1000000";
process.env.RATE_LIMIT_COMMENT_DAILY_MAX = process.env.RATE_LIMIT_COMMENT_DAILY_MAX || "1000000";
process.env.RATE_LIMIT_THESIS_MAX = process.env.RATE_LIMIT_THESIS_MAX || "1000000";
process.env.RATE_LIMIT_PREVIEW_MAX = process.env.RATE_LIMIT_PREVIEW_MAX || "1000000";
process.env.RATE_LIMIT_LIKE_MAX = process.env.RATE_LIMIT_LIKE_MAX || "1000000";
process.env.RATE_LIMIT_VERIFICATION_OTP_MAX =
  process.env.RATE_LIMIT_VERIFICATION_OTP_MAX || "1000000";

// Push is best-effort and would otherwise try to reach Postgres/Expo; the
// service short-circuits when disabled. push.test.js re-enables it locally.
process.env.PUSH_ENABLED = process.env.PUSH_ENABLED || "false";
