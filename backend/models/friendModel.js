const db = require("../db");
const { DEFAULT_LIMIT } = require("./pagination");

/**
 * Friendships (Messaging_plan.md §5). Mutual: request → accept/decline; an
 * accepted friendship is a bypass in the permission engine (§4).
 *
 * The pair is stored in whichever direction the requester created it, but the
 * unique index (`uq_friends_pair`) is on the unordered pair, so the two users can
 * never hold two rows for the same relationship.
 */

const PEER_PROFILE = `
  json_build_object(
    'id', pr.id,
    'username', pr.username,
    'full_name', pr.full_name,
    'avatar_url', pr.avatar_url,
    'department_id', pr.department_id,
    'department_name', d.name
  ) AS peer
`;

/** The single row (if any) connecting two users, in either direction. */
const getPair = async (userA, userB) => {
  const result = await db.query(
    `SELECT * FROM public.friendships
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1);`,
    [userA, userB]
  );
  return result.rows[0];
};

/**
 * Creates a pending request, or re-opens a previously declined one. Callers
 * must have already rejected a block or an existing pending/accepted row.
 */
const upsertRequest = async (requesterId, addresseeId) => {
  const result = await db.query(
    `INSERT INTO public.friendships (requester_id, addressee_id, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
     DO UPDATE SET requester_id = EXCLUDED.requester_id,
                   addressee_id = EXCLUDED.addressee_id,
                   status = 'pending',
                   created_at = NOW(),
                   responded_at = NULL
     RETURNING *;`,
    [requesterId, addresseeId]
  );
  return result.rows[0];
};

/** Accepted friends, with the other party's profile. */
const listFriends = async (userId, { limit = DEFAULT_LIMIT } = {}) => {
  const sql = `
    SELECT
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'department_id', pr.department_id,
        'department_name', d.name
      ) AS peer,
      f.created_at AS friends_since
    FROM public.friendships f
    LEFT JOIN public.profiles pr
      ON pr.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE f.status = 'accepted' AND (f.requester_id = $1 OR f.addressee_id = $1)
    ORDER BY pr.full_name ASC NULLS LAST
    LIMIT $2;
  `;
  const result = await db.query(sql, [userId, limit]);
  return result.rows;
};

const listIncomingRequests = async (userId, { limit = DEFAULT_LIMIT } = {}) => {
  const sql = `
    SELECT f.id, f.requester_id, f.created_at,
      json_build_object(
        'id', pr.id, 'username', pr.username, 'full_name', pr.full_name,
        'avatar_url', pr.avatar_url, 'department_id', pr.department_id,
        'department_name', d.name) AS requester
    FROM public.friendships f
    LEFT JOIN public.profiles pr ON pr.id = f.requester_id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE f.status = 'pending' AND f.addressee_id = $1
    ORDER BY f.created_at DESC
    LIMIT $2;
  `;
  const result = await db.query(sql, [userId, limit]);
  return result.rows;
};

const listOutgoingRequests = async (userId, { limit = DEFAULT_LIMIT } = {}) => {
  const sql = `
    SELECT f.id, f.addressee_id, f.created_at,
      json_build_object(
        'id', pr.id, 'username', pr.username, 'full_name', pr.full_name,
        'avatar_url', pr.avatar_url, 'department_id', pr.department_id,
        'department_name', d.name) AS addressee
    FROM public.friendships f
    LEFT JOIN public.profiles pr ON pr.id = f.addressee_id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE f.status = 'pending' AND f.requester_id = $1
    ORDER BY f.created_at DESC
    LIMIT $2;
  `;
  const result = await db.query(sql, [userId, limit]);
  return result.rows;
};

/**
 * Addressee-only response to a pending request. Returns `undefined` (→ 404) when
 * the caller is not the addressee or the row is not pending.
 */
const respond = async (id, addresseeId, status) => {
  const result = await db.query(
    `UPDATE public.friendships
        SET status = $3, responded_at = NOW()
      WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
      RETURNING *;`,
    [id, addresseeId, status]
  );
  return result.rows[0];
};

/**
 * Friend suggestions for the feed carousel and Find Friends.
 *
 * Ranking (Messaging_plan.md §5):
 *   1. mutual friends, count descending
 *   2. same department
 *   3. full score: course match, year-level match, department match, mutuals
 *
 * Excludes: self, any friendship row (pending or accepted, both directions),
 * blocked in either direction, suspended accounts, and guests.
 *
 * `reason` labels which tier produced the placement: 'mutual' | 'department' |
 * 'campus'. It is a presentation hint, not an authorization input.
 */
const listSuggestions = async (userId, { limit = 8 } = {}) => {
  const sql = `
    WITH me AS (
      SELECT $1::text AS id
    ),
    my_friends AS (
      SELECT CASE WHEN requester_id = $1 THEN addressee_id
                  ELSE requester_id END AS peer_id
      FROM public.friendships
      WHERE status = 'accepted'
        AND (requester_id = $1 OR addressee_id = $1)
    ),
    excluded AS (
      SELECT $1::text AS peer_id
      UNION ALL
      SELECT CASE WHEN requester_id = $1 THEN addressee_id
                  ELSE requester_id END
      FROM public.friendships
      WHERE requester_id = $1 OR addressee_id = $1
      UNION ALL
      SELECT blocked_id FROM public.blocks WHERE blocker_id = $1
      UNION ALL
      SELECT blocker_id FROM public.blocks WHERE blocked_id = $1
    ),
    candidates AS (
      SELECT p.id, p.full_name, p.username, p.avatar_url,
             d.name AS department_name, c.name AS course_name,
             p.department_id, p.course_id, p.year_level
      FROM public.profiles p
      LEFT JOIN public.departments d ON d.id = p.department_id
      LEFT JOIN public.courses c ON c.id = p.course_id
      WHERE p.id <> $1
        AND p.suspended_at IS NULL
        AND (p.suspended_until IS NULL OR p.suspended_until <= NOW())
        AND NOT EXISTS (SELECT 1 FROM excluded e WHERE e.peer_id = p.id)
    ),
    mutuals AS (
      SELECT cand.id AS candidate_id, COUNT(*) AS n
      FROM candidates cand
      JOIN public.friendships f
        ON f.status = 'accepted'
        AND (f.requester_id = cand.id OR f.addressee_id = cand.id)
        AND f.requester_id <> $1 AND f.addressee_id <> $1
      JOIN my_friends mf
        ON mf.peer_id = CASE WHEN f.requester_id = cand.id
                            THEN f.addressee_id ELSE f.requester_id END
      GROUP BY cand.id
    )
    SELECT
      cand.id,
      cand.full_name,
      cand.username,
      cand.avatar_url,
      cand.department_name,
      cand.course_name,
      cand.department_id,
      cand.course_id,
      cand.year_level,
      COALESCE(m.n, 0) AS mutual_count,
      CASE
        WHEN COALESCE(m.n, 0) > 0 THEN 'mutual'
        WHEN cand.department_id = (SELECT department_id FROM public.profiles WHERE id = $1)
          THEN 'department'
        ELSE 'campus'
      END AS reason
    FROM candidates cand
    LEFT JOIN mutuals m ON m.candidate_id = cand.id
    ORDER BY
      COALESCE(m.n, 0) DESC,
      (cand.department_id = (SELECT department_id FROM public.profiles WHERE id = $1)) DESC,
      (cand.course_id = (SELECT course_id FROM public.profiles WHERE id = $1)) DESC,
      (cand.year_level = (SELECT year_level FROM public.profiles WHERE id = $1)) DESC,
      COALESCE(m.n, 0) DESC,
      cand.full_name ASC NULLS LAST
    LIMIT $2;
  `;
  const result = await db.query(sql, [userId, limit]);
  return result.rows;
};

/** Unfriend, or cancel a request you sent — from either side. */
const removePair = async (userId, otherId) => {
  const result = await db.query(
    `DELETE FROM public.friendships
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1)
      RETURNING *;`,
    [userId, otherId]
  );
  return result.rows[0];
};

module.exports = {
  getPair,
  upsertRequest,
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  respond,
  removePair,
  listSuggestions,
};
