const db = require("../db");

/**
 * Raw SQL Model for Notifications
 */

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
    WHERE user_id = $1 AND is_read = FALSE;
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

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
