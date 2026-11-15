const db = require("../db");
const { DEFAULT_LIMIT } = require("./pagination");

/**
 * Saved Post Data Model
 * Handles bookmarking/saving posts for authenticated users.
 * Visibility of saved posts is strictly verified against visible_posts().
 */

/**
 * Save a post for a user.
 * Idempotent (ON CONFLICT DO NOTHING).
 */
const savePost = async (userId, postId) => {
  // 1. Verify post exists and is visible to the user
  const check = await db.query(
    `SELECT 1 FROM visible_posts($1::text) WHERE id = $2 AND deleted_at IS NULL`,
    [userId, postId]
  );

  if (check.rows.length === 0) {
    const error = new Error("Post not found or not visible");
    error.code = "POST_NOT_FOUND";
    error.status = 404;
    throw error;
  }

  // 2. Insert into saved_posts
  await db.query(
    `INSERT INTO public.saved_posts (user_id, post_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, post_id) DO NOTHING`,
    [userId, postId]
  );

  return { saved: true, postId };
};

/**
 * Unsave / remove a saved post for a user.
 */
const unsavePost = async (userId, postId) => {
  const result = await db.query(
    `DELETE FROM public.saved_posts
     WHERE user_id = $1 AND post_id = $2
     RETURNING id`,
    [userId, postId]
  );

  return { saved: false, postId, removed: result.rowCount > 0 };
};

/**
 * Check if a post is saved by a user.
 */
const isPostSaved = async (userId, postId) => {
  if (!userId || !postId) return false;
  const result = await db.query(
    `SELECT 1 FROM public.saved_posts WHERE user_id = $1 AND post_id = $2`,
    [userId, postId]
  );
  return result.rows.length > 0;
};

/**
 * List all saved posts for a user, joined with post details and author profile.
 * Only returns posts that remain visible to the user.
 */
const listSavedPosts = async (userId, { limit = DEFAULT_LIMIT, cursor = null } = {}) => {
  const params = [userId];
  const conditions = [];

  if (cursor) {
    params.push(cursor);
    conditions.push(`sp.created_at < $${params.length}::timestamptz`);
  }

  params.push(limit);
  const limitIndex = params.length;

  const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT 
      p.id,
      p.author_id,
      p.content,
      p.type,
      p.title,
      p.technologies,
      p.github_url,
      p.image_url,
      p.image_urls,
      p.preview_metadata,
      p.moderation_status,
      p.moderation_reason,
      p.created_at,
      p.updated_at,
      p.visibility,
      p.allow_reposts,
      p.author_department_id,
      p.author_course_id,
      COALESCE((SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id), 0) AS likes,
      COALESCE((SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id AND c.moderation_status != 'hidden'), 0) AS comments,
      COALESCE((SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id), 0) AS like_count,
      COALESCE((SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id AND c.moderation_status != 'hidden'), 0) AS comment_count,
      p.repost_count,
      sp.created_at AS saved_at,
      TRUE AS is_saved,
      (SELECT EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1)) AS is_liked,
      (SELECT EXISTS(SELECT 1 FROM reposts r WHERE r.original_post_id = p.id AND r.reposter_id = $1 AND r.deleted_at IS NULL)) AS is_reposted,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'department_id', pr.department_id,
        'department_name', d.name,
        'role', pr.role,
        'verification_status', pr.verification_status
      ) AS author
    FROM public.saved_posts sp
    JOIN visible_posts($1::text) p ON sp.post_id = p.id
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE p.deleted_at IS NULL
      ${whereClause}
    ORDER BY sp.created_at DESC
    LIMIT $${limitIndex}
  `;

  const result = await db.query(sql, params);
  const rows = result.rows;
  const nextCursor = rows.length === limit ? rows[rows.length - 1].saved_at : null;

  return {
    posts: rows,
    nextCursor,
  };
};

module.exports = {
  savePost,
  unsavePost,
  isPostSaved,
  listSavedPosts,
};

