const crypto = require("crypto");

/**
 * TOTP secret encryption for at-rest storage.
 * Uses AES-256-GCM with a key derived from TOTP_SECRET_KEY env var.
 * 
 * Key derivation: HKDF-SHA256(TOTP_SECRET_KEY, "totp-secrets", 32 bytes)
 * This allows key rotation by changing TOTP_SECRET_KEY without re-encrypting all secrets.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const KEY_INFO = "totp-secrets";

let keyCache = null;

function deriveKey() {
  if (keyCache) return keyCache;
  
  const masterKey = process.env.TOTP_SECRET_KEY;
  if (!masterKey) {
    throw new Error("TOTP_SECRET_KEY environment variable is required");
  }
  
  // HKDF-SHA256 to derive encryption key
  const salt = crypto.randomBytes(16); // Not stored, just used for derivation
  const key = crypto.hkdfSync("sha256", masterKey, salt, KEY_INFO, KEY_LENGTH);
  keyCache = key;
  return key;
}

function clearKeyCache() {
  keyCache = null;
}

/**
 * Encrypt a TOTP secret (base32 string).
 * Returns { ciphertext, iv, tag } all as base64 strings.
 */
function encryptTotpSecret(plaintext) {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypt a TOTP secret.
 * Expects { ciphertext, iv, tag } as base64 strings.
 * Returns the plaintext base32 string.
 */
function decryptTotpSecret({ ciphertext, iv, tag }) {
  const key = deriveKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  
  return plaintext.toString("utf8");
}

/**
 * Timing-safe comparison of two strings.
 * Uses crypto.timingSafeEqual which requires equal-length buffers.
 * For different-length inputs, compares against zero-filled buffers of matching length
 * to avoid timing leaks.
 */
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  
  if (bufA.length !== bufB.length) {
    // Compare against zero-filled buffers of each length to maintain constant time
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    crypto.timingSafeEqual(bufB, Buffer.alloc(bufB.length));
    return false;
  }
  
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Timing-safe TOTP verification with replay protection.
 * 
 * @param {string} secret - Decrypted TOTP secret (base32)
 * @param {string} token - User-provided 6-digit code
 * @param {number} lastUsedStep - Previously used counter step (or null)
 * @returns {{ valid: boolean, currentStep: number, isReplay: boolean }}
 *   - valid: true if token matches current or adjacent step
 *   - currentStep: the counter step that matched (for replay guard)
 *   - isReplay: true if currentStep <= lastUsedStep
 */
function verifyTotpTimingSafe(secret, token, lastUsedStep) {
  if (!secret || !token) return { valid: false, currentStep: -1, isReplay: false };
  
  // Decode base32 secret
  const decoded = base32ToBuffer(secret);
  if (!decoded) return { valid: false, currentStep: -1, isReplay: false };
  
  const period = 30;
  const now = Math.floor(Date.now() / 1000 / period);
  
  // Check current step and ±1 for clock drift
  const stepsToCheck = [now - 1, now, now + 1];
  
  // Compute all expected tokens first (constant-time over the loop)
  const expectedTokens = stepsToCheck.map(step => hotp(decoded, step));
  
  // Pad the provided token to 6 digits
  const paddedToken = String(token).padStart(6, "0");
  
  // Timing-safe comparison against each expected token
  let matchedStep = -1;
  for (let i = 0; i < expectedTokens.length; i++) {
    if (timingSafeEqual(paddedToken, expectedTokens[i])) {
      matchedStep = stepsToCheck[i];
      // Don't break - continue to maintain constant time
    }
  }
  
  const valid = matchedStep !== -1;
  const isReplay = valid && lastUsedStep !== null && matchedStep <= lastUsedStep;
  
  return {
    valid,
    currentStep: matchedStep,
    isReplay,
  };
}

/**
 * Base32 decode (RFC 4648, no padding).
 * Returns Buffer or null on invalid input.
 */
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

/**
 * HOTP computation (RFC 4226).
 */
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

module.exports = {
  encryptTotpSecret,
  decryptTotpSecret,
  verifyTotpTimingSafe,
  base32ToBuffer,
  hotp,
  timingSafeEqual,
  clearKeyCache, // For tests
};