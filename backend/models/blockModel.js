const db = require("../db");

// =============================================================================
// BLOCK MODEL
// =============================================================================
// Handles user blocking. Block is bidirectional - both users cannot see each other's
// posts, cannot message each other, cannot repost each other's content.
// =============================================================================

/**
 * Block a user.
 * Creates a bidirectional block relationship.
 * 
 * @param {string} blockerId - User ID of person doing the blocking
 * @param {string} blockedId - User ID of person being blocked
 * @returns {Promise<Object>} Created block record
 */
const blockUser = async (blockerId, blockedId) => {
  if (blockerId === blockedId) {
    const error = new Error("Cannot block yourself");
    error.code = "CANNOT_BLOCK_SELF";
    throw error;
  }
  
  // Check if already blocked
  const existing = await db.query(
    `SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    [blockerId, blockedId]
  );
  
  if (existing.rows.length > 0) {
    const error = new Error("Already blocked");
    error.code = "ALREADY_BLOCKED";
    throw error;
  }
  
  // Insert block (bidirectional - we insert one row, but the visibility functions
  // check both directions via the blocks table)
  const result = await db.query(
    `INSERT INTO blocks (blocker_id, blocked_id)
     VALUES ($1, $2)
     RETURNING *`,
    [blockerId, blockedId]
  );
  
  return result.rows[0];
};

/**
 * Unblock a user.
 * 
 * @param {string} blockerId - User ID of person who blocked
 * @param {string} blockedId - User ID of person who was blocked
 * @returns {Promise<Object|null>} Deleted block or null if not found
 */
const unblockUser = async (blockerId, blockedId) => {
  const result = await db.query(
    `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2 RETURNING *`,
    [blockerId, blockedId]
  );
  
  return result.rows[0] || null;
};

/**
 * List users blocked by a user.
 * 
 * @param {string} blockerId - User ID
 * @param {number} limit - Max rows
 * @param {string|null} cursor - Keyset cursor
 * @returns {Promise<Array>} Array of blocked users with profile info
 */
const listBlocked = async (blockerId, { limit = 100, cursor = null } = {}) => {
  const params = [blockerId];
  const conditions = [];
  
  if (cursor) {
    const [createdAt, blockedId] = String(cursor).split("|");
    if (createdAt && blockedId) {
      params.push(createdAt, blockedId);
      conditions.push(`(
        b.created_at < $${params.length - 1}::timestamptz
        OR (b.created_at = $${params.length - 1}::timestamptz AND b.blocked_id < $${params.length}::uuid)
      )`);
    }
  }
  
  const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
  params.push(limit);
  
  const sql = `
    SELECT 
      b.blocked_id,
      b.created_at,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'course', pr.course,
        'year_level', pr.year_level
      ) AS user
    FROM blocks b
    LEFT JOIN profiles pr ON b.blocked_id = pr.id
    WHERE b.blocker_id = $1 ${whereClause}
    ORDER BY b.created_at DESC, b.blocked_id DESC
    LIMIT $${params.length};
  `;
  
  const result = await db.query(sql, params);
  return result.rows;
};

/**
 * Check if two users have a block relationship (either direction).
 * Used by visible_posts() and visible_reposts_for_post() database functions.
 * 
 * @param {string} userA - First user ID
 * @param {string} userB - Second user ID
 * @returns {Promise<boolean>} True if blocked in either direction
 */
const isBlocked = async (userA, userB) => {
  const result = await db.query(
    `SELECT 1 FROM blocks 
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)`,
    [userA, userB]
  );
  return result.rows.length > 0;
};

/**
 * Check if a specific user has blocked another user.
 * 
 * @param {string} blockerId - Potential blocker
 * @param {string} blockedId - Potential blocked user
 * @returns {Promise<boolean>} True if blockerId has blocked blockedId
 */
const hasBlocked = async (blockerId, blockedId) => {
  const result = await db.query(
    `SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    [blockerId, blockedId]
  );
  return result.rows.length > 0;
};

/**
 * Check if a user is blocked by another user.
 * 
 * @param {string} userId - User who might be blocked
 * @param {string} byUserId - Potential blocker
 * @returns {Promise<boolean>} True if userId is blocked by byUserId
 */
const isBlockedBy = async (userId, byUserId) => {
  return hasBlocked(byUserId, userId);
};

module.exports = {
  blockUser,
  unblockUser,
  listBlocked,
  isBlocked,
  hasBlocked,
  isBlockedBy,
};