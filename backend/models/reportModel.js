const db = require("../db");

// =============================================================================
// REPORT MODEL
// =============================================================================
// Handles report creation and admin moderation.
// UNIQUE constraint on (reporter_id, target_type, target_id) prevents duplicate reports.
// =============================================================================

const VALID_TARGET_TYPES = ['post', 'repost', 'comment', 'thesis', 'message', 'profile'];
const VALID_REASONS = ['spam', 'harassment', 'inappropriate', 'misinformation', 'copyright', 'other'];
const VALID_STATUSES = ['pending', 'reviewed', 'dismissed', 'actioned'];

/**
 * Create a report.
 * Duplicate reports (same reporter, target_type, target_id) are rejected by UNIQUE constraint.
 * 
 * @param {string} reporterId - User ID of reporter
 * @param {string} targetType - One of: post, repost, comment, thesis, message, profile
 * @param {string} targetId - UUID of target
 * @param {string} reason - One of: spam, harassment, inappropriate, misinformation, copyright, other
 * @param {string|null} note - Optional note
 * @returns {Promise<Object>} Created report
 */
const createReport = async (reporterId, targetType, targetId, reason, note = null) => {
  // Validate target_type
  if (!VALID_TARGET_TYPES.includes(targetType)) {
    const error = new Error("Invalid target_type");
    error.code = "INVALID_TARGET_TYPE";
    throw error;
  }
  
  // Validate reason
  if (!VALID_REASONS.includes(reason)) {
    const error = new Error("Invalid reason");
    error.code = "INVALID_REASON";
    throw error;
  }
  
  try {
    const result = await db.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [reporterId, targetType, targetId, reason, note]
    );
    return result.rows[0];
  } catch (err) {
    // Handle unique constraint violation (duplicate report)
    if (err.code === '23505' && err.constraint === 'reports_unique_reporter_target') {
      const error = new Error("Already reported this content");
      error.code = "DUPLICATE_REPORT";
      throw error;
    }
    throw err;
  }
};

/**
 * Open reports for the moderation queue.
 *
 * `target_id` has no foreign key, so the target is resolved through LEFT JOINs
 * on the four target surfaces. The department filter applies to the target
 * author's department (COALESCE across the joins), mirroring how the post,
 * comment, and message queues scope on the author. An unresolvable target has
 * a NULL department, which never matches a department filter — fail-closed, so
 * only campus admins see those.
 *
 * @param {Object} options
 * @param {string|null} options.departmentId - Scope to a department, or null for all
 * @param {number} options.limit - Max rows
 * @returns {Promise<Array>} Reports with reporter, target author, and excerpt
 */
const listOpenReports = async ({ departmentId = null, limit = 100 } = {}) => {
  const params = [];
  let deptCondition = "";
  if (departmentId) {
    params.push(departmentId);
    deptCondition = `AND target_author.department_id = $${params.length}::uuid`;
  }
  params.push(limit);

  const sql = `
    SELECT
      r.id, r.target_type, r.target_id, r.reason, r.note, r.status, r.created_at,
      json_build_object(
        'id', reporter.id,
        'username', reporter.username,
        'full_name', reporter.full_name,
        'avatar_url', reporter.avatar_url
      ) AS reporter,
      json_build_object(
        'id', target_author.id,
        'username', target_author.username,
        'full_name', target_author.full_name,
        'avatar_url', target_author.avatar_url,
        'department_id', target_author.department_id,
        'department_name', td.name
      ) AS author,
      COALESCE(
        rp.content,
        cm.content,
        mg.body,
        CASE WHEN r.target_type = 'profile' THEN tp.bio END
      ) AS excerpt,
      rp.id AS post_id
    FROM reports r
    LEFT JOIN profiles reporter ON reporter.id = r.reporter_id
    LEFT JOIN posts rp
      ON r.target_type = 'post' AND rp.id = r.target_id
    LEFT JOIN comments cm
      ON r.target_type = 'comment' AND cm.id = r.target_id
    LEFT JOIN messages mg
      ON r.target_type = 'message' AND mg.id = r.target_id
    LEFT JOIN profiles tp
      ON r.target_type = 'profile' AND tp.id = r.target_id::text
    LEFT JOIN profiles target_author
      ON target_author.id = COALESCE(rp.author_id, cm.user_id, mg.sender_id, tp.id)
    LEFT JOIN departments td ON td.id = target_author.department_id
    WHERE r.status = 'pending' ${deptCondition}
    ORDER BY r.created_at DESC
    LIMIT $${params.length};
  `;
  const result = await db.query(sql, params);
  return result.rows;
};

/**
 * A single report with the target author's department, for the scope check.
 * Same join structure as `listOpenReports` but for one id.
 */
const getReportForModeration = async (id) => {
  const sql = `
    SELECT r.id, r.target_type, r.target_id, r.reporter_id, r.status,
           target_author.department_id AS author_department_id
      FROM reports r
      LEFT JOIN posts rp
        ON r.target_type = 'post' AND rp.id = r.target_id
      LEFT JOIN comments cm
        ON r.target_type = 'comment' AND cm.id = r.target_id
      LEFT JOIN messages mg
        ON r.target_type = 'message' AND mg.id = r.target_id
      LEFT JOIN profiles tp
        ON r.target_type = 'profile' AND tp.id = r.target_id::text
      LEFT JOIN profiles target_author
        ON target_author.id = COALESCE(rp.author_id, cm.user_id, mg.sender_id, tp.id)
     WHERE r.id = $1;
  `;
  const result = await db.query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Update report status (admin only).
 *
 * @param {string} reportId - Report UUID
 * @param {string} status - New status
 * @param {string} reviewerId - Admin user ID
 * @returns {Promise<Object|null>} Updated report or null if not found
 */
const updateReportStatus = async (reportId, status, reviewerId) => {
  if (!VALID_STATUSES.includes(status)) {
    const error = new Error("Invalid status");
    error.code = "INVALID_STATUS";
    throw error;
  }
  
  const result = await db.query(
    `UPDATE reports
     SET status = $1, reviewed_by = $2
     WHERE id = $3
     RETURNING *`,
    [status, reviewerId, reportId]
  );
  
  return result.rows[0] || null;
};

module.exports = {
  createReport,
  listOpenReports,
  getReportForModeration,
  updateReportStatus,
};