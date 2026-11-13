/**
 * CORS Configuration and Strict HTTPS Enforcement
 * Ensures all web origins in production use strict HTTPS and prevents
 * insecure localhost defaults from leaking into production.
 */

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19000",
  "http://127.0.0.1:19000",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
  "http://localhost:3000",
];

function normalizeOrigin(origin) {
  if (typeof origin !== "string") return "";
  return origin.trim().replace(/\/+$/, "");
}

function getAllowedOrigins({
  env = process.env.NODE_ENV,
  corsOrigins = process.env.CORS_ORIGINS,
} = {}) {
  const isProd = env === "production";

  if (!corsOrigins) {
    return isProd ? [] : DEFAULT_DEV_ORIGINS.map(normalizeOrigin);
  }

  const parsed = corsOrigins
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  if (isProd) {
    const validHttps = [];
    for (const origin of parsed) {
      if (/^https:\/\//i.test(origin)) {
        validHttps.push(origin);
      } else {
        console.warn(`[cors] Insecure HTTP origin ignored in production: ${origin}`);
      }
    }
    return validHttps;
  }

  return parsed;
}

function createCorsOptions(options = {}) {
  const allowed = getAllowedOrigins(options);

  return {
    origin(origin, callback) {
      // Requests without an Origin header (mobile apps, curl, server-to-server)
      // are permitted.
      if (!origin) {
        return callback(null, true);
      }

      const normalized = normalizeOrigin(origin);
      if (allowed.includes(normalized)) {
        return callback(null, true);
      }

      // Blocked: return false so Express CORS omits Access-Control-Allow-Origin
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  };
}

module.exports = {
  DEFAULT_DEV_ORIGINS,
  normalizeOrigin,
  getAllowedOrigins,
  createCorsOptions,
};

