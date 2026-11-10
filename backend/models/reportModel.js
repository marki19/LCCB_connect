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
 * List reports (admin only).
 * Supports filtering by status and target_type.
 * 
 * @param {Object} options
 * @param {string|null} options.status - Filter by status
 * @param {string|null} options.targetType - Filter by target_type
 * @param {number} options.limit - Max rows
 * @param {string|null} options.cursor - Keyset cursor
 * @returns {Promise<Array>} Array of reports
 */
const listReports = async ({ status = null, targetType = null, limit = 100, cursor = null } = {}) => {
  const params = [];
  const conditions = [];
  
  if (status && VALID_STATUSES.includes(status)) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  
  if (targetType && VALID_TARGET_TYPES.includes(targetType)) {
    params.push(targetType);
    conditions.push(`target_type = $${params.length}`);
  }
  
  if (cursor) {
    const [createdAt, id] = String(cursor).split("|");
    if (createdAt && id) {
      params.push(createdAt, id);
      conditions.push(`(
        created_at < $${params.length - 1}::timestamptz
        OR (created_at = $${params.length - 1}::timestamptz AND id < $${params.length}::uuid)
      )`);
    }
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);
  
  const sql = `
    SELECT 
      r.id,
      r.reporter_id,
      r.target_type,
      r.target_id,
      r.reason,
      r.note,
      r.status,
      r.reviewed_by,
      r.created_at,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url
      ) AS reporter
    FROM reports r
    LEFT JOIN profiles pr ON r.reporter_id = pr.id
    ${whereClause}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT $${params.length};
  `;
  
  const result = await db.query(sql, params);
  return result.rows;
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

/**
 * Get report by ID (admin only).
 * 
 * @param {string} reportId - Report UUID
 * @returns {Promise<Object|null>} Report or null
 */
const getReportById = async (reportId) => {
  const result = await db.query(
    `SELECT * FROM reports WHERE id = $1`,
    [reportId]
  );
  return result.rows[0] || null;
};

module.exports = {
  createReport,
  listReports,
  updateReportStatus,
  getReportById,
};