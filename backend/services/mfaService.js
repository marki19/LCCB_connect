const crypto = require("crypto");
const qrcode = require("qrcode");
const db = require("../db");
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
  const userIdentifier = email || userId;
  const label = encodeURIComponent(`${issuer}:${userIdentifier}`);
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
  const name = `TOTP ${new Date().toISOString().slice(0, 10)}`;

  try {
    await db.query(
      `DELETE FROM public.mfa_factors WHERE user_id = $1 AND type = 'totp' AND status = 'unverified'`,
      [userId]
    );

    const result = await db.query(
      `INSERT INTO public.mfa_factors (user_id, type, name, secret, status)
       VALUES ($1, 'totp', $2, $3, 'unverified')
       RETURNING *`,
      [userId, name, JSON.stringify(encryptedSecret)]
    );
    return result.rows[0];
  } catch {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("mfa_factors")
      .delete()
      .eq("user_id", userId)
      .eq("type", "totp")
      .eq("status", "unverified")
      .catch(() => undefined);

    const { data, error } = await supabase
      .from("mfa_factors")
      .insert({
        user_id: userId,
        type: "totp",
        name,
        secret: JSON.stringify(encryptedSecret),
        status: "unverified",
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

/**
 * Verify and activate a TOTP factor.
 * Uses timing-safe comparison and replay protection via last_used_step.
 */
async function verifyTotpFactor(userId, factorId, token) {
  let factor = null;
  try {
    const res = await db.query(
      `SELECT * FROM public.mfa_factors WHERE id = $1 AND user_id = $2`,
      [factorId, userId]
    );
    factor = res.rows[0];
  } catch {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("mfa_factors")
      .select("*")
      .eq("id", factorId)
      .eq("user_id", userId)
      .single();
    factor = data;
  }

  if (!factor) {
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
    const encryptedSecret = typeof factor.secret === "string" ? JSON.parse(factor.secret) : factor.secret;
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
  try {
    const updateRes = await db.query(
      `UPDATE public.mfa_factors
       SET status = 'verified',
           verified_at = NOW(),
           last_used_step = $1
       WHERE id = $2
       RETURNING *`,
      [currentStep, factorId]
    );
    return updateRes.rows[0];
  } catch {
    const supabase = getSupabaseAdmin();
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
}

/**
 * List all factors for a user.
 */
async function listFactors(userId) {
  try {
    const res = await db.query(
      `SELECT * FROM public.mfa_factors WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows;
  } catch {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("mfa_factors")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }
}

/**
 * Delete a factor (unenroll MFA).
 */
async function deleteFactor(userId, factorId) {
  try {
    await db.query(
      `DELETE FROM public.mfa_factors WHERE id = $1 AND user_id = $2`,
      [factorId, userId]
    );
  } catch {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("mfa_factors")
      .delete()
      .eq("id", factorId)
      .eq("user_id", userId);
    if (error) throw error;
  }
}

/**
 * Check if user has at least one verified TOTP factor.
 */
async function hasVerifiedTotp(userId) {
  try {
    const res = await db.query(
      `SELECT 1 FROM public.mfa_factors
       WHERE user_id = $1 AND type = 'totp' AND status = 'verified'
       LIMIT 1`,
      [userId]
    );
    return res.rows.length > 0;
  } catch {
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
  try {
    await db.query(
      `INSERT INTO public.session_events (user_id, event_type, aal, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4::inet, $5, $6::jsonb)`,
      [
        userId,
        eventType,
        aal,
        ipAddress || null,
        userAgent || null,
        JSON.stringify(metadata || {}),
      ]
    );
  } catch {
    try {
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
    } catch {
      // Non-critical audit log - ignore failure
    }
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
    eventType: "login",
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
  verifyTotpTimingSafe,
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
  recordLogin,
  recordLogout,
  recordMfaEnroll,
  recordMfaUnenroll,
  recordMfaChallenge,
};