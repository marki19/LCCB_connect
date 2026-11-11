const crypto = require("crypto");
const qrcode = require("qrcode");
const { getSupabaseAdmin } = require("./supabaseAdmin");
const { record, ACTIONS } = require("./auditService");
const { encryptTotpSecret, decryptTotpSecret, verifyTotpTimingSafe } = require("../utils/totpEncryption");

/**
 * Base32 encode a Buffer (RFC 4648, no padding).
 */
function toBase32(buf) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += alphabet[(value << (5 - bits)) & 31];
  }
  return out;
}

/**
 * Generate a TOTP secret (20 bytes = 32 base32 chars).
 * Returns { secret, encryptedSecret, uri, qrCodeDataUrl }.
 * QR code is generated locally using the 'qrcode' package.
 * The encryptedSecret is stored at rest; secret is only returned to the user
 * during enrollment and is never stored in plaintext.
 */
async function generateTotpSecret(userId, email, issuer = "LCCB Connect") {
  const secretBytes = crypto.randomBytes(20);
  const secret = toBase32(secretBytes);
  const label = encodeURIComponent(`${issuer}:${email}`);
  const issuerParam = encodeURIComponent(issuer);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${issuerParam}&algorithm=SHA1&digits=6&period=30`;
  // Generate QR code locally as a data URL
  const qrCodeDataUrl = await qrcode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 1 });
  // Encrypt the secret for at-rest storage
  const encryptedSecret = encryptTotpSecret(secret);
  return { secret, encryptedSecret, uri, qrCodeDataUrl };
}

/**
 * Verify a TOTP code against a secret.
 * Allows ±1 step window (30s before/after) for clock drift.
 */
function verifyTotp(secret, token) {
  if (!secret || !token) return false;
  const decoded = base32ToBuffer(secret);
  if (!decoded) return false;
  const period = 30;
  const now = Math.floor(Date.now() / 1000 / period);
  for (let i = -1; i <= 1; i++) {
    const expected = hotp(decoded, now + i);
    if (expected === String(token).padStart(6, "0")) return true;
  }
  return false;
}

function base32ToBuffer(str) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = str.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(key, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
}

/**
 * Store a new TOTP factor for the user (status = 'unverified').
 * Returns the factor record.
 * The secret is stored encrypted at rest; last_used_step is initialized to null.
 */
async function createTotpFactor(userId, encryptedSecret) {
  const supabase = getSupabaseAdmin();
  const name = `TOTP ${new Date().toISOString().slice(0, 10)}`;
  const { data, error } = await supabase
    .from("mfa_factors")
    .insert({
      user_id: userId,
      type: "totp",
      name,
      secret: JSON.stringify(encryptedSecret),
      status: "unverified",
      last_used_step: null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Verify and activate a TOTP factor.
 * Uses timing-safe comparison and replay protection via last_used_step.
 */
async function verifyTotpFactor(userId, factorId, token) {
  const supabase = getSupabaseAdmin();
  const { data: factor, error: fetchError } = await supabase
    .from("mfa_factors")
    .select("*")
    .eq("id", factorId)
    .eq("user_id", userId)
    .single();
  if (fetchError || !factor) {
    const err = new Error("Factor not found");
    err.status = 404;
    throw err;
  }
  if (factor.status === "verified") {
    const err = new Error("Factor already verified");
    err.status = 409;
    throw err;
  }
  if (factor.type !== "totp") {
    const err = new Error("Invalid factor type");
    err.status = 400;
    throw err;
  }

  // Decrypt the secret
  let decryptedSecret;
  try {
    const encryptedSecret = JSON.parse(factor.secret);
    decryptedSecret = decryptTotpSecret(encryptedSecret);
  } catch (e) {
    console.error("[mfa] Failed to decrypt TOTP secret:", e.message);
    const err = new Error("Factor configuration error");
    err.status = 500;
    throw err;
  }

  // Timing-safe verification with replay protection
  const { valid, currentStep, isReplay } = verifyTotpTimingSafe(
    decryptedSecret,
    token,
    factor.last_used_step
  );

  if (!valid) {
    const err = new Error("Invalid code");
    err.status = 401;
    throw err;
  }

  if (isReplay) {
    const err = new Error("Code already used");
    err.status = 401;
    throw err;
  }

  // Update factor with verified status and record the used step
  const { data, error } = await supabase
    .from("mfa_factors")
    .update({
      status: "verified",
      verified_at: new Date().toISOString(),
      last_used_step: currentStep,
    })
    .eq("id", factorId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * List all factors for a user.
 */
async function listFactors(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("mfa_factors")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Delete a factor (unenroll MFA).
 */
async function deleteFactor(userId, factorId) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("mfa_factors")
    .delete()
    .eq("id", factorId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Check if user has at least one verified TOTP factor.
 */
async function hasVerifiedTotp(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("mfa_factors")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "totp")
    .eq("status", "verified")
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Record a session event (login, logout, mfa_challenge, force_signout).
 */
async function recordSessionEvent({
  userId,
  eventType,
  aal = null,
  ipAddress = null,
  userAgent = null,
  metadata = {},
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("session_events").insert({
    user_id: userId,
    event_type: eventType,
    aal,
    ip_address: ipAddress,
    user_agent: userAgent,
    metadata,
  });
  if (error) {
    console.error("[mfa] Failed to record session event:", error.message);
  }
}

/**
 * Get the AAL (Authenticator Assurance Level) from a session token.
 * Supabase includes `aal` in the JWT claims when MFA is enrolled.
 * Returns 'aal1', 'aal2', or 'aal1' (default).
 */
function getAalFromToken(token) {
  if (!token) return "aal1";
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return "aal1";
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return payload.aal || "aal1";
  } catch {
    return "aal1";
  }
}

/**
 * Middleware to enforce AAL2 for admin roles.
 * Must run after requireAuth + loadProfile (and checkSessionAge).
 */
async function requireAal2(req, res, next) {
  const role = req.profile?.role?.toLowerCase().replace(/[-_]/g, "");
  if (role !== "admin" && role !== "superadmin") {
    return next(); // Non-admins: AAL1 is fine
  }

  // 1. Check req.sessionAal (set by checkSessionAge) or JWT claims
  let aal = req.sessionAal || getAalFromToken(req.accessToken);

  // 2. If not aal2, check session_events / memory cache
  if (aal !== "aal2" && req.user?.id) {
    const cache = checkSessionAge.cache;
    const cached = cache?.get(req.user.id);
    if (cached?.valid && cached?.aal === "aal2") {
      aal = "aal2";
    } else {
      try {
        const supabase = getSupabaseAdmin();
        const { data: events } = await supabase
          .from("session_events")
          .select("created_at, event_type, aal")
          .eq("user_id", req.user.id)
          .in("event_type", ["login", "logout", "force_signout"])
          .order("created_at", { ascending: false })
          .limit(1);

        if (events?.[0]?.event_type === "login" && events[0]?.aal === "aal2") {
          aal = "aal2";
        }
      } catch (err) {
        console.error("[mfa] Failed to check AAL from session events:", err.message);
      }
    }
  }

  if (aal !== "aal2") {
    return res.status(403).json({
      error: "Multi-factor authentication required",
      code: "mfa_required",
      aal: "aal2",
    });
  }
  next();
}

/**
 * Check if the current session is within the allowed time window and not revoked.
 * - All roles: 7 days max
 * - Admin/superadmin: 24 hours max
 * Caches session lookup in memory for 60s per user.
 */
async function checkSessionAge(req, res, next) {
  if (!req.user?.id) return next();

  // Cache session lookup in memory for 60s per user
  const now = Date.now();
  const cache = checkSessionAge.cache || (checkSessionAge.cache = new Map());
  const cached = cache.get(req.user.id);
  if (cached && now - cached.ts < 60000) {
    if (!cached.valid) {
      return res.status(401).json({
        error: cached.error || "Session expired",
        code: "session_expired",
      });
    }
    req.sessionAal = cached.aal;
    return next();
  }

  try {
    const supabase = getSupabaseAdmin();
    // Query recent session events (login, logout, force_signout)
    const { data: events, error } = await supabase
      .from("session_events")
      .select("created_at, event_type, aal")
      .eq("user_id", req.user.id)
      .in("event_type", ["login", "logout", "force_signout"])
      .order("created_at", { ascending: false })
      .limit(1);

    let valid = true;
    let errorMessage = "Session expired. Please sign in again.";
    let aal = "aal1";

    if (!error && events?.length > 0) {
      const latest = events[0];
      if (latest.event_type === "logout" || latest.event_type === "force_signout") {
        valid = false;
        errorMessage = "Session has been logged out. Please sign in again.";
      } else {
        const loginTime = new Date(latest.created_at).getTime();
        const ageMs = now - loginTime;
        const role = req.profile?.role?.toLowerCase().replace(/[-_]/g, "");
        const maxAgeMs = (role === "admin" || role === "superadmin")
          ? 24 * 60 * 60 * 1000 // 24 hours
          : 7 * 24 * 60 * 60 * 1000; // 7 days
        valid = ageMs <= maxAgeMs;
        aal = latest.aal || "aal1";
      }
    }

    cache.set(req.user.id, { valid, ts: now, aal, error: errorMessage });
    req.sessionAal = aal;

    if (!valid) {
      return res.status(401).json({
        error: errorMessage,
        code: "session_expired",
      });
    }
    next();
  } catch (err) {
    // On error, allow through but log
    console.error("[session-age] Check failed:", err.message);
    next();
  }
}

/**
 * Clear session age cache for a user (e.g., on logout or force signout).
 */
function clearSessionAgeCache(userId) {
  const cache = checkSessionAge.cache;
  if (cache) cache.delete(userId);
}

/**
 * Log successful login and return AAL.
 */
async function recordLogin({
  userId,
  req,
  aal = "aal1",
  mfaChallenged = false,
}) {
  const ip = req.ip || req.headers["x-forwarded-for"] || null;
  const ua = req.headers["user-agent"] || null;
  await recordSessionEvent({
    userId,
    eventType: mfaChallenged ? "mfa_challenge" : "login",
    aal,
    ipAddress: ip,
    userAgent: ua,
    metadata: { mfa_challenged: mfaChallenged },
  });

  // Also write to admin_audit_log
  try {
    await record({
      actor: { id: userId },
      action: ACTIONS.LOGIN_SUCCESS,
      targetType: "auth.session",
      targetId: userId,
      metadata: { aal, ip: ip, mfa_challenged: mfaChallenged },
    });
  } catch (e) {
    console.error("[audit] Login audit failed:", e.message);
  }
}

/**
 * Log logout.
 */
async function recordLogout({ userId, req }) {
  const ip = req.ip || req.headers["x-forwarded-for"] || null;
  const ua = req.headers["user-agent"] || null;
  await recordSessionEvent({
    userId,
    eventType: "logout",
    ipAddress: ip,
    userAgent: ua,
  });

  try {
    await record({
      actor: { id: userId },
      action: ACTIONS.LOGOUT,
      targetType: "auth.session",
      targetId: userId,
      metadata: { ip: ip },
    });
  } catch (e) {
    console.error("[audit] Logout audit failed:", e.message);
  }
}

/**
 * Log MFA enrollment.
 */
async function recordMfaEnroll({ userId, req, factorId }) {
  try {
    await record({
      actor: { id: userId },
      action: ACTIONS.MFA_ENROLL,
      targetType: "mfa.factor",
      targetId: factorId,
      metadata: { type: "totp" },
    });
  } catch (e) {
    console.error("[audit] MFA enroll audit failed:", e.message);
  }
}

/**
 * Log MFA unenrollment.
 */
async function recordMfaUnenroll({ userId, req, factorId }) {
  try {
    await record({
      actor: { id: userId },
      action: ACTIONS.MFA_UNENROLL,
      targetType: "mfa.factor",
      targetId: factorId,
      metadata: { type: "totp" },
    });
  } catch (e) {
    console.error("[audit] MFA unenroll audit failed:", e.message);
  }
}

/**
 * Log MFA challenge (failed verification attempt).
 */
async function recordMfaChallenge({ userId, req, success }) {
  try {
    await record({
      actor: { id: userId },
      action: ACTIONS.MFA_CHALLENGE,
      targetType: "mfa.challenge",
      targetId: userId,
      metadata: { success },
    });
  } catch (e) {
    console.error("[audit] MFA challenge audit failed:", e.message);
  }
}

// ---- login MFA challenge ----------------------------------------------------
// A first-factor login that needs a TOTP code returns a signed challenge token
// plus a server-side pending session. The token carries only an opaque `jti`;
// the session stays in memory and is claimed after the code verifies, so a
// forged token can never reach TOTP verification or mint tokens on its own.

const MFA_CHALLENGE_TTL_SECONDS = 300; // 5 minutes
const pendingMfaChallenges = new Map(); // jti -> { userId, session, expiresAt }

let cachedChallengeSecret = null;

function getChallengeSecret() {
  if (cachedChallengeSecret) return cachedChallengeSecret;
  const secret =
    process.env.MFA_CHALLENGE_SECRET ||
    (process.env.NODE_ENV === "test" ? "test-mfa-challenge-secret-0123456789" : "");
  if (!secret) {
    throw new Error("MFA_CHALLENGE_SECRET is not configured");
  }
  cachedChallengeSecret = secret;
  return cachedChallengeSecret;
}

function encodeSegment(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signChallenge(header, payload) {
  return crypto
    .createHmac("sha256", getChallengeSecret())
    .update(`${header}.${payload}`)
    .digest("base64url");
}

function timingSafeEqualStrings(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Issues a signed MFA challenge token and stores the pending session under its
 * `jti`. Returns the token the client must send back with the TOTP code.
 */
function createMfaChallenge(userId, session) {
  const jti = crypto.randomBytes(16).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const header = encodeSegment({ alg: "HS256", typ: "JWT" });
  const payload = encodeSegment({
    sub: userId,
    type: "mfa_challenge",
    jti,
    iat: now,
    exp: now + MFA_CHALLENGE_TTL_SECONDS,
  });
  const signature = signChallenge(header, payload);

  pendingMfaChallenges.set(jti, {
    userId,
    session,
    expiresAt: Date.now() + MFA_CHALLENGE_TTL_SECONDS * 1000,
  });
  if (pendingMfaChallenges.size > 1000) {
    const cutoff = Date.now();
    for (const [key, entry] of pendingMfaChallenges) {
      if (entry.expiresAt < cutoff) pendingMfaChallenges.delete(key);
    }
  }

  return `${header}.${payload}.${signature}`;
}

/**
 * Verifies the token signature and expiry, then confirms a matching pending
 * session exists. Does not consume the session, so a wrong TOTP code can be
 * retried within the rate limit.
 *
 * @returns {{ userId: string, jti: string } | null}
 */
function resolveMfaChallenge(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = signChallenge(header, payload);
  if (!timingSafeEqualStrings(signature, expected)) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (
    claims?.type !== "mfa_challenge" ||
    typeof claims.jti !== "string" ||
    typeof claims.sub !== "string" ||
    typeof claims.exp !== "number"
  ) {
    return null;
  }
  if (claims.exp < Math.floor(Date.now() / 1000)) return null;

  const entry = pendingMfaChallenges.get(claims.jti);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pendingMfaChallenges.delete(claims.jti);
    return null;
  }
  if (entry.userId !== claims.sub) return null;

  return { userId: entry.userId, jti: claims.jti };
}

/**
 * Claims the pending session for a resolved challenge (single use).
 *
 * @returns {{ userId: string, session: object } | null}
 */
function consumeMfaChallenge(jti) {
  const entry = pendingMfaChallenges.get(jti);
  if (!entry) return null;
  pendingMfaChallenges.delete(jti);
  if (entry.expiresAt < Date.now()) return null;
  return { userId: entry.userId, session: entry.session };
}

/** Test helper: drops every pending challenge. */
function _clearPendingMfaChallenges() {
  pendingMfaChallenges.clear();
}

module.exports = {
  generateTotpSecret,
  verifyTotp,
  decryptTotpSecret,
  createTotpFactor,
  verifyTotpFactor,
  listFactors,
  deleteFactor,
  hasVerifiedTotp,
  createMfaChallenge,
  resolveMfaChallenge,
  consumeMfaChallenge,
  _clearPendingMfaChallenges,
  recordSessionEvent,
  getAalFromToken,
  requireAal2,
  checkSessionAge,
  clearSessionAgeCache,
  recordLogin,
  recordLogout,
  recordMfaEnroll,
  recordMfaUnenroll,
  recordMfaChallenge,
};