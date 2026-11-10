const db = require("../db");

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
      `SELECT * FROM visible_posts($1::text) WHERE id = $2 AND deleted_at IS NULL`,
      [reposterId, originalPostId]
    );
    
    if (originalResult.rows.length === 0) {
      const error = new Error("Original post not found or not visible");
      error.code = "POST_NOT_FOUND";
      throw error;
    }
    
    const original = originalResult.rows[0];
    
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
    
    // ---- 8. Create notification for original author (skip if same) ----
    if (original.author_id !== reposterId) {
      await client.query(
        `INSERT INTO notifications (user_id, actor_id, type, target_id, message, department_id)
         VALUES ($1, $2, 'repost', $3, $4, $5)`,
        [
          original.author_id,
          reposterId,
          repost.id,
          `${reposterId} reposted your post`,
          original.author_department_id
        ]
      );
    }
    
    // Return repost with original post data
    return {
      ...repost,
      original_post: {
        id: original.id,
        author_id: original.author_id,
        content: original.content,
        type: original.type,
        title: original.title,
        technologies: original.technologies,
        github_url: original.github_url,
        image_url: original.image_url,
        preview_metadata: original.preview_metadata,
        visibility: original.visibility,
        allow_reposts: original.allow_reposts,
        author_department_id: original.author_department_id,
        author_course_id: original.author_course_id,
        repost_count: original.repost_count + 1, // incremented
        deleted_at: original.deleted_at,
        edited_at: original.edited_at,
        moderation_status: original.moderation_status,
        moderation_reason: original.moderation_reason,
        created_at: original.created_at,
        author: original.author,
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
    `SELECT * FROM visible_reposts_for_post($1::uuid, $2::text)`,
    [originalPostId, viewerId]
  );
  
  return result.rows.map(row => ({
    kind: 'repost',
    repost: {
      id: row.id,
      reposter_id: row.reposter_id,
      original_post_id: row.original_post_id,
      caption: row.caption,
      visibility: row.visibility,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
    },
    // Original post data
    id: row.id,
    author_id: row.author_id,
    content: row.content,
    type: row.type,
    title: row.title,
    technologies: row.technologies,
    github_url: row.github_url,
    image_url: row.image_url,
    preview_metadata: row.preview_metadata,
    visibility: row.visibility,
    allow_reposts: row.allow_reposts,
    author_department_id: row.author_department_id,
    author_course_id: row.author_course_id,
    repost_count: row.repost_count,
    deleted_at: row.deleted_at,
    edited_at: row.edited_at,
    moderation_status: row.moderation_status,
    moderation_reason: row.moderation_reason,
    created_at: row.created_at,
    likes: row.likes,
    comments: row.comments,
    author: row.author,
    is_liked: row.is_liked,
  }));
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