const db = require("../db");

/**
 * Raw SQL Model for Notifications
 *
 * Messages are deliberately absent from this surface. They have their own tab,
 * and `pushService.notifyNewMessage` already puts them on the status bar and
 * lock screen. `new_message` / `message_request` rows are therefore filtered
 * out of every read here, so neither the list nor the badge counts them.
 */

const EXCLUDED_TYPES = "('new_message', 'message_request')";

const getUserNotifications = async (userId, { limit = 30 } = {}) => {
  const sql = `
    SELECT 
      n.id,
      n.user_id,
      n.actor_id,
      n.type,
      n.target_id,
      n.department,
      n.message,
      n.is_read,
      n.created_at,
      json_build_object(
        'id', pr.id,
        'full_name', pr.full_name,
        'username', pr.username,
        'avatar_url', pr.avatar_url
      ) AS actor
    FROM public.notifications n
    LEFT JOIN public.profiles pr ON n.actor_id = pr.id
    WHERE n.user_id = $1
      AND n.type NOT IN ${EXCLUDED_TYPES}
    ORDER BY n.created_at DESC
    LIMIT $2;
  `;
  const result = await db.query(sql, [userId, limit]);
  return result.rows;
};

const getUnreadCount = async (userId) => {
  const sql = `
    SELECT COUNT(*)::int AS unread
    FROM public.notifications
    WHERE user_id = $1
      AND is_read = FALSE
      AND type NOT IN ${EXCLUDED_TYPES};
  `;
  const result = await db.query(sql, [userId]);
  return result.rows[0]?.unread || 0;
};

const markAsRead = async (id, userId) => {
  const sql = `
    UPDATE public.notifications
    SET is_read = TRUE
    WHERE id = $1 AND user_id = $2
    RETURNING *;
  `;
  const result = await db.query(sql, [id, userId]);
  return result.rows[0];
};

const markAllAsRead = async (userId) => {
  const sql = `
    UPDATE public.notifications
    SET is_read = TRUE
    WHERE user_id = $1 AND is_read = FALSE
    RETURNING id;
  `;
  const result = await db.query(sql, [userId]);
  return result.rows;
};

/**
 * Create a repost notification.
 * Skips if the original author is the same as the reposter.
 * 
 * @param {string} originalAuthorId - User ID of original post author
 * @param {string} reposterId - User ID of person who reposted
 * @param {string} repostId - UUID of the repost
 * @returns {Promise<Object|null>} Created notification or null if skipped
 */
const createRepostNotification = async (originalAuthorId, reposterId, repostId) => {
  if (originalAuthorId === reposterId) {
    return null;
  }
  
  const result = await db.query(
    `INSERT INTO notifications (user_id, actor_id, type, target_id, repost_id, message, department_id)
     VALUES ($1, $2, 'repost', $3, $3, $4, $5)
     RETURNING *`,
    [
      originalAuthorId,
      reposterId,
      repostId,
      `${reposterId} reposted your post`,
      null // department_id will be fetched from actor's profile if needed
    ]
  );
  
  return result.rows[0];
};

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createRepostNotification,
};
