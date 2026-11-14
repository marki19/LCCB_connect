/**
 * Native Authentication & Token Service
 *
 * Implements self-hosted JWT issuance, token verification, and bcrypt password
 * management for 100% on-premise execution without cloud dependencies.
 */

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const db = require("../db");

const BCRYPT_COST = 12;

// Persistent or configured JWT secrets
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== "test") {
  throw new Error("FATAL: JWT_SECRET environment variable is required.");
}
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === "test" ? "test-jwt-secret-for-unit-tests" : "");
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (JWT_SECRET ? JWT_SECRET + "-refresh" : "");

// Standard expirations: 15-minute access token for all roles (refresh handles rotation)
const ACCESS_TTL_SEC = 15 * 60; // 15 minutes
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

/**
 * Persists a refresh token jti row to the database.
 */
async function persistRefreshToken(jti, userId, expiresAt) {
  try {
    await db.query(
      `INSERT INTO public.refresh_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3)`,
      [jti, userId, expiresAt]
    );
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[nativeAuth] Could not persist refresh token ${jti}: ${err.message}`);
    }
  }
}

/**
 * Fetches a refresh token record by jti.
 */
async function getRefreshToken(jti) {
  if (!jti) return null;
  try {
    const { rows } = await db.query(
      `SELECT jti, user_id, expires_at, revoked_at FROM public.refresh_tokens WHERE jti = $1`,
      [jti]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * Marks a single refresh token as revoked.
 */
async function revokeRefreshToken(jti) {
  if (!jti) return false;
  try {
    const result = await db.query(
      `UPDATE public.refresh_tokens SET revoked_at = NOW() WHERE jti = $1 AND revoked_at IS NULL`,
      [jti]
    );
    return (result.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Revokes all active refresh tokens for a user.
 */
async function revokeAllUserRefreshTokens(userId) {
  if (!userId) return 0;
  try {
    const result = await db.query(
      `UPDATE public.refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
    return result.rowCount || 0;
  } catch {
    return 0;
  }
}

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
async function signTokens(user, { aal = "aal1" } = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = nowSec + ACCESS_TTL_SEC;

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
      role: user.role || "user",
    },
    aal,
    iat: nowSec,
    exp: expiresAt,
  };

  const accessToken = jwt.sign(accessPayload, JWT_SECRET);

  const jti = crypto.randomUUID();
  const refreshExpiresSec = nowSec + REFRESH_TTL_SEC;
  const refreshExpiresAt = new Date(refreshExpiresSec * 1000);

  const refreshPayload = {
    sub: user.id,
    jti,
    token_type: "refresh",
    iat: nowSec,
    exp: refreshExpiresSec,
  };

  const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET);

  // Persist refresh token row for revocation tracking
  await persistRefreshToken(jti, user.id, refreshExpiresAt);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    expires_in: ACCESS_TTL_SEC,
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
  persistRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  JWT_SECRET,
  ACCESS_TTL_SEC,
  REFRESH_TTL_SEC,
};

