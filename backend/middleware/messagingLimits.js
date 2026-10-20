const rateLimit = require("express-rate-limit");

/**
 * Messaging rate limits (Messaging_plan.md §6, §13). Keyed by the authenticated
 * user (`req.user.id`), so a shared campus NAT still gets per-account budgets.
 * These run *after* requireAuth, inside the routers, so `req.user` is set.
 *
 * Env-tunable so the test suite (and load runs) can raise the ceiling.
 */
const parseLimit = (raw, fallback) => {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const keyByUser = (req) => req.user.id;

const limiter = (overrides) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUser,
    ...overrides,
  });

// Sends (and opening a thread): 20/min and 200/day per sender by default. The
// daily cap is the deliberate brake on unlimited pre-accept messaging (§6).
const messagingSendLimiter = limiter({
  windowMs: 60_000,
  limit: parseLimit(process.env.RATE_LIMIT_SEND_MAX, 20),
  message: { error: "You're sending messages too quickly. Please slow down." },
});

const messagingDailyLimiter = limiter({
  windowMs: 24 * 60 * 60 * 1000,
  limit: parseLimit(process.env.RATE_LIMIT_SEND_DAILY_MAX, 200),
  message: { error: "Daily message limit reached. Try again tomorrow." },
});

const friendRequestLimiter = limiter({
  windowMs: 60_000,
  limit: parseLimit(process.env.RATE_LIMIT_FRIEND_MAX, 20),
  message: { error: "Too many friend requests. Please slow down." },
});

const reportLimiter = limiter({
  windowMs: 60_000,
  limit: parseLimit(process.env.RATE_LIMIT_REPORT_MAX, 10),
  message: { error: "Too many reports. Please slow down." },
});

module.exports = {
  messagingSendLimiter,
  messagingDailyLimiter,
  friendRequestLimiter,
  reportLimiter,
};
