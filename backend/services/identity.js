const db = require("../db");

/**
 * Normalizes a raw string into a handle:
 * lowercase, strip to [a-z0-9.], collapse multiple dots, trim dots, truncate to 30 chars.
 */
function sanitizeHandle(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

/**
 * Derives the base candidate username from fullName or id.
 * Format:
 * - single word: word
 * - two words: first.last (e.g. "Mark Antipo" -> "mark.antipo")
 * - 3+ words: first.rest (e.g. "Juan Dela Cruz" -> "juan.delacruz")
 * - fallback if < 3 chars or missing: "student" + last 6 of id
 */
function deriveBaseUsername(fullName, id) {
  if (fullName && typeof fullName === "string") {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      let raw;
      if (parts.length === 1) {
        raw = parts[0];
      } else if (parts.length === 2) {
        raw = `${parts[0]}.${parts[1]}`;
      } else {
        raw = `${parts[0]}.${parts.slice(1).join("")}`;
      }
      const cleaned = sanitizeHandle(raw).slice(0, 30);
      if (cleaned.length >= 3) {
        return cleaned;
      }
    }
  }

  // Fallback: 'student' + last 6 alphanumeric characters of id
  const idStr = String(id || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const suffix = idStr.length >= 6 ? idStr.slice(-6) : idStr.padEnd(6, "0");
  return `student${suffix}`.slice(0, 30);
}

/**
 * Asynchronously derives a unique username for a user, resolving collisions
 * by suffixing _2, _3, etc.
 *
 * @param {string} fullName
 * @param {string} id
 * @param {object} [dbClient=db]
 * @returns {Promise<string>}
 */
async function deriveUsername(fullName, id, dbClient = db) {
  const base = deriveBaseUsername(fullName, id);
  let candidate = base;
  let counter = 2;

  while (true) {
    const res = await dbClient.query(
      "SELECT id FROM profiles WHERE lower(username) = lower($1) AND id != $2 LIMIT 1",
      [candidate, id || "00000000-0000-0000-0000-000000000000"]
    );

    if (res.rows.length === 0) {
      return candidate;
    }

    const suffix = `_${counter}`;
    const maxBaseLen = 30 - suffix.length;
    candidate = `${base.slice(0, maxBaseLen)}${suffix}`;
    counter++;
  }
}

module.exports = {
  sanitizeHandle,
  deriveBaseUsername,
  deriveUsername,
};
