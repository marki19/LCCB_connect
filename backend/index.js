require("dotenv").config();

// --- boot-time environment validation (fail fast) ---------------------------
const REQUIRED_ENV = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "MFA_CHALLENGE_SECRET"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`[boot] Missing required environment variable(s): ${missingEnv.join(", ")}`);
  console.error("[boot] Copy backend/.env.example to backend/.env and fill in the values.");
  process.exit(1);
}

// Required only after the environment is validated: `app` reads env at load
// time (Supabase client, CORS origins, rate limits, validation URL prefix).
const app = require("./app");
const { pool } = require("./db");
const { redact } = require("./utils/redact");
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

let isShuttingDown = false;
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[shutdown] Received ${signal}. Starting graceful shutdown...`);

  const forceTimer = setTimeout(() => {
    console.error("[shutdown] Graceful shutdown timed out after 10s. Forcing exit.");
    process.exit(1);
  }, 10_000);
  forceTimer.unref();

  server.close(async (err) => {
    if (err) {
      console.error("[shutdown] Error closing HTTP server:", err);
    } else {
      console.log("[shutdown] HTTP server closed to new connections.");
    }

    try {
      await pool.end();
      console.log("[shutdown] PostgreSQL connection pool drained.");
    } catch (poolErr) {
      console.error("[shutdown] Error closing PostgreSQL pool:", poolErr);
    }

    clearTimeout(forceTimer);
    process.exit(0);
  });

  // `server.close()` waits for idle keep-alive sockets to time out, so without
  // this every deploy sits on the 10s force timer. Idle connections are dropped;
  // requests already in flight still complete before the callback above runs.
  if (typeof server.closeIdleConnections === "function") {
    server.closeIdleConnections();
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("[fatal] Uncaught exception:", redact(err?.stack || err?.message || err));
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[fatal] Unhandled promise rejection:", redact(reason?.stack || reason?.message || reason));
  process.exit(1);
});
