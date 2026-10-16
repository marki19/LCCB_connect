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
};
