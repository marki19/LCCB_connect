const db = require("../db");

/**
 * Social settings (Messaging_plan.md §1, §5, §7, §8): blocks, the "who can
 * message me" policy + allow-list, presence, and device tokens.
 */

// ---- blocks (§7) -----------------------------------------------------------

const block = async (blockerId, blockedId) => {
  const result = await db.query(
    `INSERT INTO public.blocks (blocker_id, blocked_id)
     VALUES ($1, $2)
     ON CONFLICT (blocker_id, blocked_id) DO NOTHING
     RETURNING blocker_id, blocked_id, created_at;`,
    [blockerId, blockedId]
  );
  return result.rows[0] || { blocker_id: blockerId, blocked_id: blockedId };
};

const unblock = async (blockerId, blockedId) => {
  const result = await db.query(
    `DELETE FROM public.blocks
      WHERE blocker_id = $1 AND blocked_id = $2
      RETURNING blocker_id, blocked_id;`,
    [blockerId, blockedId]
  );
  return result.rows[0];
};

const isBlocked = async (blockerId, blockedId) => {
  const result = await db.query(
    `SELECT 1 FROM public.blocks WHERE blocker_id = $1 AND blocked_id = $2;`,
    [blockerId, blockedId]
  );
  return result.rowCount > 0;
};

const listBlocked = async (blockerId) => {
  const result = await db.query(
    `SELECT b.blocked_id, b.created_at,
       json_build_object('id', pr.id, 'username', pr.username, 'full_name', pr.full_name,
                         'avatar_url', pr.avatar_url) AS peer
     FROM public.blocks b
     LEFT JOIN public.profiles pr ON pr.id = b.blocked_id
     WHERE b.blocker_id = $1
     ORDER BY b.created_at DESC;`,
    [blockerId]
  );
  return result.rows;
};

// ---- "who can message me" policy (§4) -------------------------------------

const getMessagePolicy = async (userId) => {
  const result = await db.query(
    `SELECT p.message_policy,
       COALESCE(
         (SELECT json_agg(pd.department_id)
            FROM public.message_policy_departments pd
           WHERE pd.user_id = $1),
         '[]'::json
       ) AS department_ids
     FROM public.profiles p
     WHERE p.id = $1;`,
    [userId]
  );
  return result.rows[0];
};

/**
 * Sets the policy and, for `selected`, replaces the department allow-list.
 * Both live in one transaction so a reader never sees a `selected` policy with
 * a half-updated list.
 */
const setMessagePolicy = async (userId, policy, departmentIds = null) => {
  return db.withTransaction(async (client) => {
    await client.query(`UPDATE public.profiles SET message_policy = $2 WHERE id = $1;`, [
      userId,
      policy,
    ]);

    if (Array.isArray(departmentIds)) {
      await client.query(`DELETE FROM public.message_policy_departments WHERE user_id = $1;`, [userId]);
      if (departmentIds.length > 0) {
        await client.query(
          `INSERT INTO public.message_policy_departments (user_id, department_id)
           SELECT $1, unnest($2::uuid[])
           ON CONFLICT (user_id, department_id) DO NOTHING;`,
          [userId, departmentIds]
        );
      }
    }

    return getMessagePolicyWith(client, userId);
  });
};

const getMessagePolicyWith = async (client, userId) => {
  const result = await client.query(
    `SELECT p.message_policy,
       COALESCE(
         (SELECT json_agg(pd.department_id)
            FROM public.message_policy_departments pd
           WHERE pd.user_id = $1),
         '[]'::json
       ) AS department_ids
     FROM public.profiles p
     WHERE p.id = $1;`,
    [userId]
  );
  return result.rows[0];
};

// ---- presence (§8) ---------------------------------------------------------

const setPresenceMode = async (userId, mode) => {
  const result = await db.query(
    `UPDATE public.profiles SET presence_mode = $2 WHERE id = $1
     RETURNING presence_mode;`,
    [userId, mode]
  );
  return result.rows[0];
};

/** Throttled heartbeat: always stamps `last_seen_at`; mode/visibility optional. */
const heartbeat = async (userId, { mode = null, lastSeenVisible = null } = {}) => {
  const result = await db.query(
    `UPDATE public.profiles
        SET last_seen_at = NOW(),
            presence_mode = COALESCE($2, presence_mode),
            last_seen_visible = COALESCE($3, last_seen_visible)
      WHERE id = $1
      RETURNING presence_mode, last_seen_at, last_seen_visible;`,
    [userId, mode, lastSeenVisible]
  );
  return result.rows[0];
};

// ---- device tokens (§7) ----------------------------------------------------

const addDeviceToken = async (userId, token, platform) => {
  const result = await db.query(
    `INSERT INTO public.device_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, token) DO UPDATE
       SET platform = EXCLUDED.platform, updated_at = NOW()
     RETURNING id, user_id, token, platform, created_at, updated_at;`,
    [userId, token, platform]
  );
  return result.rows[0];
};

const removeDeviceToken = async (userId, token) => {
  const result = await db.query(
    `DELETE FROM public.device_tokens WHERE user_id = $1 AND token = $2 RETURNING id;`,
    [userId, token]
  );
  return result.rows[0];
};

/** All push targets for a user (multi-device: one row per installed app). */
const listDeviceTokens = async (userId) => {
  const result = await db.query(
    `SELECT id, user_id, token, platform FROM public.device_tokens WHERE user_id = $1;`,
    [userId]
  );
  return result.rows;
};

/**
 * Prunes tokens Expo reports as `DeviceNotRegistered` (§10). Matching on the
 * token (not the id) is what the push response gives us back.
 */
const deleteDeviceTokens = async (tokens) => {
  if (!tokens || tokens.length === 0) return 0;
  const result = await db.query(
    `DELETE FROM public.device_tokens WHERE token = ANY($1::text[]);`,
    [tokens]
  );
  return result.rowCount;
};

module.exports = {
  block,
  unblock,
  isBlocked,
  listBlocked,
  getMessagePolicy,
  setMessagePolicy,
  setPresenceMode,
  heartbeat,
  addDeviceToken,
  removeDeviceToken,
  listDeviceTokens,
  deleteDeviceTokens,
};
