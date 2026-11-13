const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

// Read the middleware off the module object (rather than destructuring) so the
// test suite can install spies before this app is built.
const auth = require("./middleware/auth");
const attachStorageUrls = require("./middleware/storageUrls");
const requestId = require("./middleware/requestId");
const { installConsoleRedactor, sanitizeUrl } = require("./utils/redact");

// Transparently redact credentials, tokens, and PII from console output
installConsoleRedactor();

// Route modules
const userRouter = require("./routes/userRouter");
const postRouter = require("./routes/postRouter");
const thesisRouter = require("./routes/thesisRouter");
const moderationRouter = require("./routes/moderationRouter");
const publicRouter = require("./routes/publicRouter");
const adminRouter = require("./routes/adminRouter");
const adminCatalogRouter = require("./routes/adminCatalogRouter");
const conversationRouter = require("./routes/conversationRouter");
const messageRouter = require("./routes/messageRouter");
const friendRouter = require("./routes/friendRouter");
const socialRouter = require("./routes/socialRouter");
const reportRouter = require("./routes/reportRouter");
const blockRouter = require("./routes/blockRouter");
const searchRouter = require("./routes/searchRouter");
const notificationRouter = require("./routes/notificationRouter");
const announcementRouter = require("./routes/announcementRouter");

// The Express app is built here and exported WITHOUT listening, so tests can
// drive it via supertest. `index.js` owns dotenv + boot-time env validation and
// calls `app.listen()`. Environment is read at require time, so import this
// module only after the environment is known to be valid.
const app = express();

// --- proxy trust -------------------------------------------------------------
// Behind a reverse proxy (nginx, Cloudflare, a load balancer) `req.ip` is the
// proxy's address unless Express is told how many hops to trust. Left unset,
// every user shares one rate-limit bucket. TRUST_PROXY accepts a hop count
// ("1"), `true` (one trusted hop), or an Express trust-proxy string.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === "true") {
  app.set("trust proxy", 1);
} else if (trustProxy && /^\d+$/.test(trustProxy)) {
  app.set("trust proxy", Number(trustProxy));
} else if (trustProxy) {
  app.set("trust proxy", trustProxy);
}

// --- CORS -------------------------------------------------------------------
// Native (iOS/Android) requests send no Origin header; browsers do.
// Production strictly enforces HTTPS origins. Override with CORS_ORIGINS.
const { createCorsOptions } = require("./utils/corsConfig");
const corsOptions = createCorsOptions();

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
app.use(compression());
app.use(helmet());
app.use(cors(corsOptions));
app.use(requestId);

// Capture raw body for Brevo webhook BEFORE express.json() parses it.
// Brevo signs the raw request body, so we need the bytes for HMAC verification.
app.use("/api/email/webhook/brevo", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "1mb" })); // bound request body size

// File columns are stored as bucket-relative keys; expand them to public URLs
// just before each response is serialized.
app.use(attachStorageUrls);

// Request log: method, path, status, duration. Never logs headers or bodies.
// Silenced under NODE_ENV=test so test output stays readable.
const logRequests = process.env.NODE_ENV !== "test";
app.use((req, res, next) => {
  if (!logRequests) return next();
  const startedAt = Date.now();
  const short = req.id ? req.id.slice(0, 8) : "no-id";
  res.on("finish", () => {
    console.log(
      `[api][${short}] ${req.method} ${sanitizeUrl(req.originalUrl)} -> ${res.statusCode} (${Date.now() - startedAt}ms)`
    );
  });
  return next();
});

// --- routes -----------------------------------------------------------------
// Baseline limit for all API traffic, stricter for writes.
app.use("/api", apiLimiter);
app.use("/api", (req, res, next) => (isWrite(req) ? writeLimiter(req, res, next) : next()));

// Public read-only endpoints (no token required)
app.use("/api/public", publicRouter);

// Authentication routes (no requireAuth! Must come before authenticated routes)
const authRouter = require("./routes/authRouter");
app.use("/api/auth", authRouter);

// Email webhook routes (public, no auth - Brevo webhooks)
const emailRouter = require("./routes/emailRouter");
app.use("/api/email", emailRouter);

// Verification routes (requireAuth + loadProfile + requireActiveAccount, NOT requireVerified)
// An unverified student is exactly who calls these.
const verificationRouter = require("./routes/verificationRouter");
app.use("/api/verification", verificationRouter);

// Every API route requires a valid Supabase access token. Identity is taken
// from the verified token, never from the request body.
app.use(
  "/api/users",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  userRouter
);
app.use(
  "/api/posts",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  postRouter
);
app.use(
  "/api/reports",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  reportRouter
);
app.use(
  "/api/blocks",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  blockRouter
);
app.use(
  "/api/theses",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  thesisRouter
);
app.use(
  "/api/search",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  searchRouter
);
app.use(
  "/api/moderation",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  moderationRouter
);
app.use(
  "/api/notifications",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  notificationRouter
);

// Messaging & social graph (Messaging_plan.md §11). `loadProfile` runs where the
// controller needs the caller's display name / department (notification text).
app.use(
  "/api/conversations",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  conversationRouter
);
app.use(
  "/api/messages",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  messageRouter
);
app.use(
  "/api/friends",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  friendRouter
);
// Same mount path as `userRouter`; `/me/...` and `/:id/block` are two-segment
// paths that the profile router never matches, so Express falls through here.
// requireAuth is idempotent and is not re-run for an already-verified request.
app.use(
  "/api/users",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  socialRouter
);

// Superadmin console API. Keep this mount before the catalog router so its
// specific paths win; unmatched paths fall through.
// Admin routes require role check + session age check (24h admin / 7d user).
// MFA is enforced at login gateway, so logged-in admins can browse uninterrupted.
const adminMiddleware = [
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  auth.requireRole("admin", "superadmin"),
  auth.checkSessionAge,
];

app.use("/api/admin", ...adminMiddleware, adminRouter);
app.use("/api/admin", ...adminMiddleware, adminCatalogRouter);

// Announcements. Not under /api/admin: department admins send them, and the
// admin mount is gated to admin + superadmin. Audience scope is enforced per
// request in the controller.
app.use(
  "/api/announcements",
  auth.requireAuth,
  auth.loadProfile,
  auth.requireActiveAccount,
  auth.requireRole("departmentAdmin", "admin", "superadmin"),
  announcementRouter
);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Backend is running!" });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: "Not found", requestId: req.id });
});

// Centralized error handler — never leak internal/database error details.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const short = req.id ? req.id.slice(0, 8) : "no-id";
  if (status >= 500) {
    console.error(`[api][${short}] Unhandled error:`, err);
    return res.status(500).json({ error: "Internal server error", requestId: req.id });
  }
  // body-parser errors carry parser internals in `err.message`; return a
  // generic message instead of echoing them.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body", requestId: req.id });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large", requestId: req.id });
  }
  // Expected client errors (401/403/404/409…) surface their message as-is.
  return res.status(status).json({ error: err.message, requestId: req.id });
});

module.exports = app;
