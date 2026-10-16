const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Read the middleware off the module object (rather than destructuring) so the
// test suite can install spies before this app is built.
const auth = require("./middleware/auth");

// Route modules
const userRouter = require("./routes/userRouter");
const postRouter = require("./routes/postRouter");
const thesisRouter = require("./routes/thesisRouter");
const moderationRouter = require("./routes/moderationRouter");

// The Express app is built here and exported WITHOUT listening, so tests can
// drive it via supertest. `index.js` owns dotenv + boot-time env validation and
// calls `app.listen()`. Environment is read at require time, so import this
// module only after the environment is known to be valid.
const app = express();

// --- CORS -------------------------------------------------------------------
// Native (iOS/Android) requests send no Origin header; browsers do. Only the
// configured origins are allowed. Override with a comma-separated CORS_ORIGINS.
const DEFAULT_ORIGINS = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19000",
  "http://127.0.0.1:19000",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
  "http://localhost:3000",
];
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;

const corsOptions = {
  origin(origin, callback) {
    // No Origin (native app, curl, same-origin) is allowed; unknown web origins
    // get no CORS headers, so the browser blocks the response.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};

// --- rate limiting ----------------------------------------------------------
// Env-tunable so load runs and the test suite can raise the ceiling.
const parseLimit = (raw, fallback) => {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const API_RATE_LIMIT = parseLimit(process.env.RATE_LIMIT_MAX, 120);
const WRITE_RATE_LIMIT = parseLimit(process.env.RATE_LIMIT_WRITE_MAX, 30);

const RATE_LIMIT_MESSAGE = { error: "Too many requests, please try again later." };
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: API_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
});
const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: WRITE_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
});
const isWrite = (req) => ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

// --- global middleware ------------------------------------------------------
app.disable("x-powered-by");
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" })); // bound request body size

// Request log: method, path, status, duration. Never logs headers or bodies.
// Silenced under NODE_ENV=test so test output stays readable.
const logRequests = process.env.NODE_ENV !== "test";
app.use((req, res, next) => {
  if (!logRequests) return next();
  const startedAt = Date.now();
  res.on("finish", () => {
    console.log(
      `[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`
    );
  });
  return next();
});

// --- routes -----------------------------------------------------------------
// Baseline limit for all API traffic, stricter for writes.
app.use("/api", apiLimiter);
app.use("/api", (req, res, next) => (isWrite(req) ? writeLimiter(req, res, next) : next()));

// Every API route requires a valid Supabase access token. Identity is taken
// from the verified token, never from the request body.
app.use("/api/users", auth.requireAuth, userRouter);
app.use("/api/posts", auth.requireAuth, postRouter);
app.use("/api/theses", auth.requireAuth, thesisRouter);
app.use("/api/moderation", auth.requireAuth, moderationRouter);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Backend is running!" });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Centralized error handler — never leak internal/database error details.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[api] Unhandled error:", err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    return res.status(500).json({ error: "Internal server error" });
  }
  // body-parser errors carry parser internals in `err.message`; return a
  // generic message instead of echoing them.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large" });
  }
  return res.status(status).json({ error: err.message });
});

module.exports = app;
