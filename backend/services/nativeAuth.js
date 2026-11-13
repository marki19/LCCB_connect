/**
 * Native Authentication & Token Service
 *
 * Implements self-hosted JWT issuance, token verification, and bcrypt password
 * management for 100% on-premise execution without cloud dependencies.
 */

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const BCRYPT_COST = 12;

// Persistent or configured JWT secrets
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || "lccb-native-jwt-secret-local-fallback-change-in-prod";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + "-refresh";

// Standard expirations
const ADMIN_ACCESS_TTL_SEC = 24 * 60 * 60; // 24 hours
const USER_ACCESS_TTL_SEC = 7 * 24 * 60 * 60; // 7 days
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

/**
 * Hash a plaintext password with bcrypt.
 */
async function hashPassword(plaintext) {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  return await bcrypt.hash(plaintext, BCRYPT_COST);
}

/**
 * Compare plaintext password with stored bcrypt hash in constant time.
 */
async function verifyPassword(plaintext, hash) {
  if (!plaintext || !hash) return false;
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    return false;
  }
}

/**
 * Mint access and refresh tokens matching Supabase's payload conventions so
 * existing client apps, components, and middlewares continue working untouched.
 */
function signTokens(user, { aal = "aal1" } = {}) {
  const role = user.role ? user.role.toLowerCase().replace(/[-_]/g, "") : "student";
  const isAdmin = role === "admin" || role === "superadmin";
  const ttlSec = isAdmin ? ADMIN_ACCESS_TTL_SEC : USER_ACCESS_TTL_SEC;
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = nowSec + ttlSec;

  const accessPayload = {
    sub: user.id,
    id: user.id,
    email: user.email || null,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {
      provider: "email",
      providers: ["email"],
    },
    user_metadata: {
      full_name: user.full_name || null,
      username: user.username || null,
      role: user.role || "student",
    },
    aal,
    iat: nowSec,
    exp: expiresAt,
  };

  const accessToken = jwt.sign(accessPayload, JWT_SECRET);

  const refreshPayload = {
    sub: user.id,
    jti: crypto.randomUUID(),
    token_type: "refresh",
    iat: nowSec,
    exp: nowSec + REFRESH_TTL_SEC,
  };

  const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    expires_in: ttlSec,
    token_type: "bearer",
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      user_metadata: accessPayload.user_metadata,
      app_metadata: accessPayload.app_metadata,
      aal,
    },
  };
}

/**
 * Verifies a native JWT access token in memory (<0.1ms latency).
 * Returns the decoded payload or null if invalid/expired.
 */
function verifyAccessToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (!decoded || !decoded.sub) return null;
    return {
      id: decoded.sub,
      email: decoded.email || null,
      role: decoded.user_metadata?.role || null,
      user_metadata: decoded.user_metadata || {},
      app_metadata: decoded.app_metadata || {},
      aal: decoded.aal || "aal1",
      exp: decoded.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies a native refresh token.
 */
function verifyRefreshToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      algorithms: ["HS256"],
    });
    if (!decoded || !decoded.sub || decoded.token_type !== "refresh") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  signTokens,
  verifyAccessToken,
  verifyRefreshToken,
  JWT_SECRET,
};
