const rateLimit = require("express-rate-limit");

/**
 * Per-user action limits.
 *
 * Every limiter here is keyed by the authenticated user, so a shared campus NAT
 * does not pool one budget across the whole network. Mount them inside a router
 * that already ran `requireAuth` (all API routers are), never at the app level.
 *
 * The global IP limiters in `app.js` remain the coarse backstop; these are the
 * per-action budgets that stop one account from flooding a single feature.
 *
 * All limits are env-tunable so load runs and the test suite can raise the
 * ceiling without changing code.
 */

const parseLimit = (raw, fallback) => {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Builds a limiter keyed by the authenticated user. Falls back to the client IP
 * for any route that somehow reaches it unauthenticated.
 */
function perUserLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
    keyGenerator: (req) =>
      req.user?.id ? `user:${req.user.id}` : rateLimit.ipKeyGenerator(req.ip),
  });
}

// ---- messaging (Messaging_plan.md §6, §13) ---------------------------------

// Burst protection only: no daily ceiling, so a long conversation is never cut
// off. 50/minute is high enough for normal back-and-forth and low enough to
// stop a scripted flood.
const messagingSendLimiter = perUserLimiter({
  windowMs: MINUTE,
  limit: parseLimit(process.env.RATE_LIMIT_SEND_MAX, 50),
  message: "You're sending messages too quickly. Please slow down.",
});

const friendRequestLimiter = perUserLimiter({
  windowMs: MINUTE,
  limit: parseLimit(process.env.RATE_LIMIT_FRIEND_MAX, 20),
  message: "Too many friend requests. Please slow down.",
});

// ---- moderation ------------------------------------------------------------

const reportLimiter = perUserLimiter({
  windowMs: HOUR,
  limit: parseLimit(process.env.RATE_LIMIT_REPORT_MAX, 20),
  message: "Too many reports. Please slow down.",
});

// ---- content creation ------------------------------------------------------

const postCreateLimiter = perUserLimiter({
  windowMs: MINUTE,
  limit: parseLimit(process.env.RATE_LIMIT_POST_MAX, 10),
  message: "You're posting too quickly. Please slow down.",
});

const postDailyLimiter = perUserLimiter({
  windowMs: DAY,
  limit: parseLimit(process.env.RATE_LIMIT_POST_DAILY_MAX, 50),
  message: "Daily post limit reached. Try again tomorrow.",
});

const repostLimiter = perUserLimiter({
  windowMs: MINUTE,
  limit: parseLimit(process.env.RATE_LIMIT_REPOST_MAX, 20),
  message: "You're reposting too quickly. Please slow down.",
});

const repostDailyLimiter = perUserLimiter({
  windowMs: DAY,
  limit: parseLimit(process.env.RATE_LIMIT_REPOST_DAILY_MAX, 100),
  message: "Daily repost limit reached. Try again tomorrow.",
});

const commentCreateLimiter = perUserLimiter({
  windowMs: MINUTE,
  limit: parseLimit(process.env.RATE_LIMIT_COMMENT_MAX, 30),
  message: "You're commenting too quickly. Please slow down.",
});

const commentDailyLimiter = perUserLimiter({
  windowMs: DAY,
  limit: parseLimit(process.env.RATE_LIMIT_COMMENT_DAILY_MAX, 200),
  message: "Daily comment limit reached. Try again tomorrow.",
});

const thesisUploadLimiter = perUserLimiter({
  windowMs: HOUR,
  limit: parseLimit(process.env.RATE_LIMIT_THESIS_MAX, 5),
  message: "Too many thesis uploads. Please try again later.",
});

// ---- read-side expensive work ---------------------------------------------

// Search has no per-user limit by design. The global IP limiter in app.js is
// still the backstop for raw request volume.
const linkPreviewLimiter = perUserLimiter({
  windowMs: MINUTE,
  limit: parseLimit(process.env.RATE_LIMIT_PREVIEW_MAX, 10),
  message: "Too many link previews. Please slow down.",
});

const likeLimiter = perUserLimiter({
  windowMs: MINUTE,
  limit: parseLimit(process.env.RATE_LIMIT_LIKE_MAX, 60),
  message: "You're reacting too quickly. Please slow down.",
});

module.exports = {
  perUserLimiter,
  messagingSendLimiter,
  friendRequestLimiter,
  reportLimiter,
  postCreateLimiter,
  postDailyLimiter,
  repostLimiter,
  repostDailyLimiter,
  commentCreateLimiter,
  commentDailyLimiter,
  thesisUploadLimiter,
  linkPreviewLimiter,
  likeLimiter,
};
