// backend/services/mentions.js
const db = require("../db");

/**
 * Extracts distinct @username tokens from free-form text.
 * Ignores email addresses (e.g. test@example.com).
 * @param {string} text
 * @returns {string[]} Lowercased usernames
 */
function extractTokens(text) {
  if (!text || typeof text !== "string") return [];
  const re = /(?:^|[^\w])@([a-z0-9._]{3,30})/gi;
  const tokens = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    tokens.push(m[1].toLowerCase());
  }
  return Array.from(new Set(tokens));
}

/**
 * Returns users that authorId can mention, optionally filtered by search query.
 * Mentionable users must be friends OR belong to the same department, excluding guests and self.
 */
async function getMentionableUsers(authorId, query = "", limit = 8, client = null) {
  const runner = client || db;
  const qTrim = (query || "").trim();
  const searchPattern = `%${qTrim}%`;
  const cappedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 8), 50);

  const sql = `
    SELECT p.id, p.username, p.full_name, p.avatar_url
    FROM public.profiles p
    LEFT JOIN public.profiles a ON a.id = $1
    WHERE p.id <> $1
      AND COALESCE(p.role, 'student') <> 'guest'
      AND p.username IS NOT NULL
      AND (
        $2 = ''
        OR p.username ILIKE $3
        OR p.full_name ILIKE $3
      )
      AND (
        public.is_friend($1, p.id)
        OR (a.department_id IS NOT NULL AND a.department_id = p.department_id)
      )
    ORDER BY p.full_name ASC
    LIMIT $4
  `;

  const res = await runner.query(sql, [authorId, qTrim, searchPattern, cappedLimit]);
  return res.rows;
}

/**
 * Resolves @handle tokens in text + explicitIds, enforcing visibility & authorization rules.
 * Rule:
 *  - Author cannot mention self.
 *  - Target cannot be a guest.
 *  - Public posts: only accepted friends may be mentioned (closes classmate exposure hole).
 *  - Department / custom / friends posts: friend OR same department allowed.
 *
 * @returns {Promise<{ allowed: string[], rejected: string[] }>}
 */
async function resolveMentionIds(
  authorId,
  text = "",
  explicitIds = [],
  { visibility = "public" } = {},
  client = null
) {
  const runner = client || db;
  const tokens = extractTokens(text);

  let tokenUserIds = [];
  if (tokens.length > 0) {
    const profileRes = await runner.query(
      `SELECT id, LOWER(username) AS uname FROM public.profiles WHERE LOWER(username) = ANY($1::text[])`,
      [tokens]
    );
    tokenUserIds = profileRes.rows.map((r) => r.id);
  }

  const allTargetIds = Array.from(new Set([...(explicitIds || []), ...tokenUserIds]));
  if (allTargetIds.length === 0) {
    return { allowed: [], rejected: [] };
  }

  const checkRes = await runner.query(
    `SELECT
       p.id,
       p.role,
       public.is_friend($1, p.id) AS is_friend,
       public.can_mention($1, p.id) AS can_mention
     FROM public.profiles p
     WHERE p.id = ANY($2::text[])`,
    [authorId, allTargetIds]
  );

  const foundMap = new Map();
  for (const row of checkRes.rows) {
    foundMap.set(row.id, row);
  }

  const allowed = [];
  const rejected = [];

  for (const tid of allTargetIds) {
    if (tid === authorId) {
      rejected.push(tid);
      continue;
    }

    const row = foundMap.get(tid);
    if (!row) {
      // If it was explicitly requested by ID and doesn't exist, reject it
      if ((explicitIds || []).includes(tid)) {
        rejected.push(tid);
      }
      continue;
    }

    if (row.role === "guest") {
      rejected.push(tid);
      continue;
    }

    if (visibility === "public") {
      // Public posts allow friends only
      if (row.is_friend) {
        allowed.push(tid);
      } else {
        rejected.push(tid);
      }
    } else {
      // Department, custom, or friend visibility allows friend OR same department
      if (row.can_mention) {
        allowed.push(tid);
      } else {
        rejected.push(tid);
      }
    }
  }

  return {
    allowed: Array.from(new Set(allowed)),
    rejected: Array.from(new Set(rejected)),
  };
}

/**
 * Replaces mentions for a post or comment in a transaction or client.
 */
async function replacePostMentions(postId, commentId = null, ids = [], client = null) {
  const runner = client || db;

  await runner.query(
    `DELETE FROM public.post_mentions
     WHERE post_id = $1 AND (
       ($2::uuid IS NULL AND comment_id IS NULL)
       OR comment_id = $2::uuid
     )`,
    [postId, commentId]
  );

  const cleanIds = Array.from(new Set(ids || [])).filter(Boolean);
  if (cleanIds.length === 0) return;

  await runner.query(
    `INSERT INTO public.post_mentions (post_id, comment_id, mentioned_user_id)
     SELECT $1, $2::uuid, u.id
     FROM unnest($3::text[]) AS u(id)
     ON CONFLICT DO NOTHING`,
    [postId, commentId, cleanIds]
  );
}

module.exports = {
  extractTokens,
  getMentionableUsers,
  resolveMentionIds,
  replacePostMentions,
};
