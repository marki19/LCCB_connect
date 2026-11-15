const db = require("../db");

/**
 * Content visibility helpers.
 *
 * The visibility rule itself lives in PostgreSQL (`visible_posts` /
 * `visible_theses`, migration 014). This module only covers the write side:
 * deciding whether a requested custom audience is legal.
 */

const VISIBILITY_LEVELS = ["public", "friends", "custom", "private"];

/**
 * De-duplicates an audience list and drops the author themselves.
 * Returns `[]` for anything that is not an array of non-empty strings.
 */
const normalizeAudience = (authorId, audience) => {
  if (!Array.isArray(audience)) return [];
  const seen = new Set();
  for (const id of audience) {
    if (typeof id !== "string" || id.length === 0 || id === authorId) continue;
    seen.add(id);
  }
  return [...seen];
};

/**
 * Returns the subset of `userIds` who are not accepted friends of `authorId`.
 *
 * Custom visibility means "these specific friends", so a non-empty result is a
 * client error: without this check a caller could share a post with any user id
 * they guessed.
 */
const findNonFriends = async (authorId, userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const { rows } = await db.query(
    `SELECT u.id
       FROM unnest($2::text[]) AS u(id)
      WHERE NOT public.is_friend($1::text, u.id)`,
    [authorId, userIds]
  );
  return rows.map((row) => row.id);
};

/**
 * Validates a request body's `audience` list for a write.
 *
 * Returns `{ audience }` on success, or `{ error, invalid? }` when the list is
 * empty after normalization or contains anyone who is not an accepted friend.
 */
const resolveAudience = async (authorId, audience) => {
  const normalized = normalizeAudience(authorId, audience);
  if (normalized.length === 0) {
    return {
      error: "A custom-visibility item needs at least one friend in its audience",
    };
  }
  const invalid = await findNonFriends(authorId, normalized);
  if (invalid.length > 0) {
    return { error: "Audience must only contain accepted friends", invalid };
  }
  return { audience: normalized };
};

module.exports = {
  VISIBILITY_LEVELS,
  normalizeAudience,
  findNonFriends,
  resolveAudience,
};
