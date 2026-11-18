const db = require("../db");
const { withDerivedImages, POST_ATTACHMENTS_SQL } = require("./postModel");

// =============================================================================
// REPOST MODEL
// =============================================================================
// Handles all repost logic: create, undo, fetch visible reposts for a post.
// All visibility enforcement goes through visible_reposts_for_post() database function.
// =============================================================================

/**
 * Create a repost.
 * Transaction:
 * 1. Original post exists, not deleted, visible to reposter via visible_posts()
 * 2. original.allow_reposts === true
 * 3. Not blocked either direction
 * 4. If target is a repost, resolve to original post
 * 5. Insert repost (visibility = narrower of reposter choice and original)
 * 6. Increment posts.repost_count
 * 7. Create notification for original author (skip if same user)
 * 
 * @param {string} originalPostId - UUID of post to repost
 * @param {string} reposterId - User ID of person reposting
 * @param {string|null} caption - Optional caption
 * @returns {Promise<Object>} Created repost with original post data
 */
const createRepost = async (originalPostId, reposterId, caption = null) => {
  return db.withTransaction(async (client) => {
    // ---- 1. Fetch original post with visibility check for reposter ----
    const originalResult = await client.query(
      `SELECT p.*,
        ${POST_ATTACHMENTS_SQL}
       FROM visible_posts($1::text) p WHERE p.id = $2 AND p.deleted_at IS NULL`,
      [reposterId, originalPostId]
    );
    
    if (originalResult.rows.length === 0) {
      const error = new Error("Original post not found or not visible");
      error.code = "POST_NOT_FOUND";
      throw error;
    }
    
    const original = withDerivedImages(originalResult.rows[0]);
    
    // ---- 2. Check allow_reposts ----
    if (original.allow_reposts !== true) {
      const error = new Error("Reposting not allowed for this post");
      error.code = "REPOSTS_NOT_ALLOWED";
      throw error;
    }
    
    // ---- 3. Check blocks (bidirectional) ----
    const blockResult = await client.query(
      `SELECT 1 FROM blocks 
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`,
      [reposterId, original.author_id]
    );
    
    if (blockResult.rows.length > 0) {
      const error = new Error("Cannot repost due to block");
      error.code = "BLOCKED";
      throw error;
    }
    
    // ---- 4. Resolve to original if target is a repost ----
    // (Reposting a repost points to the original post)
    let targetOriginalPostId = originalPostId;
    if (original.kind === 'repost' && original.repost && original.repost.original_post_id) {
      targetOriginalPostId = original.repost.original_post_id;
    }
    
    // ---- 5. Determine visibility (narrower of reposter choice and original) ----
    // Default to public for reposter's choice; original visibility is in original.visibility
    // For now, use 'public' as reposter's choice; could be extended to accept visibility param
    const reposterVisibility = 'public';
    const visibilityOrder = { 'private': 0, 'custom': 1, 'friends': 2, 'public': 3 };
    const originalVis = original.visibility || 'public';
    const resolvedVisibility = visibilityOrder[reposterVisibility] <= visibilityOrder[originalVis] 
      ? reposterVisibility 
      : originalVis;
    
    // ---- 6. Insert repost ----
    const repostResult = await client.query(
      `INSERT INTO reposts (reposter_id, original_post_id, caption, visibility)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (reposter_id, original_post_id) DO NOTHING
       RETURNING *`,
      [reposterId, targetOriginalPostId, caption, resolvedVisibility]
    );
    
    if (repostResult.rows.length === 0) {
      const error = new Error("Already reposted");
      error.code = "ALREADY_REPOSTED";
      throw error;
    }
    
    const repost = repostResult.rows[0];
    
    // ---- 7. Increment repost_count on original post ----
    await client.query(
      `UPDATE posts SET repost_count = repost_count + 1 WHERE id = $1`,
      [targetOriginalPostId]
    );
    
    // ---- 8. Return repost with original post data ----
    // The author notification is fired by the controller, outside this
    // transaction: a notification failure must not roll back a valid repost.
    return {
      ...repost,
      original_post: {
        ...original,
        repost_count: (original.repost_count || 0) + 1,
      }
    };
  });
};

/**
 * Undo a repost (soft delete).
 * Decrements repost_count on original post.
 * 
 * @param {string} originalPostId - UUID of original post
 * @param {string} reposterId - User ID of person who reposted
 * @returns {Promise<Object|null>} Deleted repost or null if not found
 */
const undoRepost = async (originalPostId, reposterId) => {
  return db.withTransaction(async (client) => {
    // First check if repost exists and belongs to reposter
    const repostResult = await client.query(
      `SELECT * FROM reposts WHERE original_post_id = $1 AND reposter_id = $2 AND deleted_at IS NULL`,
      [originalPostId, reposterId]
    );
    
    if (repostResult.rows.length === 0) {
      return null;
    }
    
    const repost = repostResult.rows[0];
    
    // Soft delete the repost
    await client.query(
      `UPDATE reposts SET deleted_at = now() WHERE id = $1`,
      [repost.id]
    );
    
    // Decrement repost_count
    await client.query(
      `UPDATE posts SET repost_count = GREATEST(repost_count - 1, 0) WHERE id = $1`,
      [originalPostId]
    );
    
    return { ...repost, deleted_at: new Date().toISOString() };
  });
};

/**
 * Get visible reposts for a post.
 * Uses visible_reposts_for_post() database function for visibility enforcement.
 * 
 * @param {string} originalPostId - UUID of original post
 * @param {string|null} viewerId - User ID for visibility gating
 * @returns {Promise<Array>} Array of reposts with original post data
 */
const getRepostsForPost = async (originalPostId, viewerId = null) => {
  const result = await db.query(
    `SELECT r.id AS repost_id,
       r.reposter_id,
       r.original_post_id,
       r.caption AS repost_caption,
       r.visibility AS repost_visibility,
       r.created_at AS repost_created_at,
       r.deleted_at AS repost_deleted_at,
       p.id,
       p.author_id,
       p.content,
       p.kind,
       p.repository_type,
       p.repository_category,
       p.live_url,
       p.title,
       p.technologies,
       p.github_url,
       p.pinned,
       ${POST_ATTACHMENTS_SQL},
       p.preview_metadata,
       p.visibility,
       p.allow_reposts,
       p.author_department_id,
       p.author_course_id,
       p.repost_count,
       p.deleted_at,
       p.edited_at,
       p.moderation_status,
       p.moderation_reason,
       p.created_at,
       COALESCE((SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id), 0) AS likes,
       COALESCE((SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id AND c.moderation_status != 'hidden'), 0) AS comments,
       json_build_object(
         'id', pr.id,
         'username', pr.username,
         'full_name', pr.full_name,
         'avatar_url', pr.avatar_url,
         'course', pr.course,
         'year_level', pr.year_level,
         'department_id', pr.department_id,
         'department_name', d.name
       ) AS author
     FROM visible_reposts_for_post($1::uuid, $2::text) r
     JOIN posts p ON p.id = r.original_post_id
     LEFT JOIN profiles pr ON pr.id = p.author_id
     LEFT JOIN departments d ON d.id = pr.department_id`,
    [originalPostId, viewerId]
  );
  
  return result.rows.map(row => {
    const derived = withDerivedImages({
      ...row,
      kind: row.kind || 'discussion',
    });
    return {
      ...derived,
      kind: 'repost',
      post_kind: derived.kind || 'discussion',
      repost: {
        id: row.repost_id,
        reposter_id: row.reposter_id,
        original_post_id: row.original_post_id,
        caption: row.repost_caption,
        visibility: row.repost_visibility,
        created_at: row.repost_created_at,
        deleted_at: row.repost_deleted_at,
      },
    };
  });
};

/**
 * Check if user has already reposted a post.
 * 
 * @param {string} originalPostId - UUID of original post
 * @param {string} reposterId - User ID
 * @returns {Promise<boolean>}
 */
const hasReposted = async (originalPostId, reposterId) => {
  const result = await db.query(
    `SELECT 1 FROM reposts WHERE original_post_id = $1 AND reposter_id = $2 AND deleted_at IS NULL`,
    [originalPostId, reposterId]
  );
  return result.rows.length > 0;
};

module.exports = {
  createRepost,
  undoRepost,
  getRepostsForPost,
  hasReposted,
};