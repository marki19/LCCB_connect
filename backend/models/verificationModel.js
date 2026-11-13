const db = require("../db");

// RAW SQL ONLY (NO ORM METHODS).

/**
 * One approval per request. The requester submits a snapshot; the reviewer never
 * reads the live profile, so an edit made mid-review cannot change what is being
 * approved.
 *
 * `role` is stored on the request (042) so the queue can be filtered by who a
 * request belongs to, not only by department, and so the reviewer matrix can be
 * re-checked against the row rather than against the requester's live profile.
 *
 * The unique partial index `uq_verification_one_pending` (migration 016) lets us
 * treat a duplicate submit as a conflict instead of a second row.
 */

/** Latest request for a user, or null. Joins department/course names and selects r.* including birthdate and role. */
const getLatestForUser = async (userId) => {
  const result = await db.query(
    `SELECT r.*, d.name AS department_name, c.name AS course_name
       FROM public.profile_verification_requests r
       LEFT JOIN public.departments d ON d.id = r.department_id
       LEFT JOIN public.courses c ON c.id = r.course_id
      WHERE r.user_id = $1
      ORDER BY r.submitted_at DESC
      LIMIT 1;`,
    [userId]
  );
  return result.rows[0] || null;
};

/** One request by id, with the display joins the queue uses. */
const getById = async (id) => {
  const result = await db.query(
    `SELECT r.*, p.email AS user_email,
            d.name AS department_name, c.name AS course_name
       FROM public.profile_verification_requests r
       JOIN public.profiles p ON p.id = r.user_id
       LEFT JOIN public.departments d ON d.id = r.department_id
       LEFT JOIN public.courses c ON c.id = r.course_id
      WHERE r.id = $1::uuid;`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Inserts a pending request. The partial unique index on
 * `user_id WHERE status = 'pending'` turns a duplicate into `23505`,
 * which the controller maps to 409.
 */
const createPending = async (userId, snapshot) => {
  const result = await db.query(
    `INSERT INTO public.profile_verification_requests
       (user_id, role, full_name, student_id, department_id, course_id, year_level, birthdate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *;`,
    [
      userId,
      snapshot.role,
      snapshot.full_name,
      snapshot.student_id,
      snapshot.department_id,
      snapshot.course_id,
      snapshot.year_level,
      snapshot.birthdate,
    ]
  );
  return result.rows[0];
};

/**
 * Updates the pending request in place (resubmission after a decline).
 * `WHERE status = 'pending'` makes a no-op when the request moved on.
 */
const updatePending = async (userId, snapshot) => {
  const result = await db.query(
    `UPDATE public.profile_verification_requests
        SET role = $2,
            full_name = $3,
            student_id = $4,
            department_id = $5,
            course_id = $6,
            year_level = $7,
            birthdate = $8,
            submitted_at = NOW()
      WHERE user_id = $1 AND status = 'pending'
      RETURNING *;`,
    [
      userId,
      snapshot.role,
      snapshot.full_name,
      snapshot.student_id,
      snapshot.department_id,
      snapshot.course_id,
      snapshot.year_level,
      snapshot.birthdate,
    ]
  );
  return result.rows[0] || null;
};

/**
 * Queue of requests, joined with profile/catalog display names.
 *
 * The caller passes the roles this reviewer may act on (from
 * `verificationPolicy.reviewableRolesFor`) and, for department-scoped reviewers,
 * their own department. `status` filters by request status. Cursor is the last
 * `submitted_at` seen (keyset pagination on a timestamp column).
 */
const listQueue = async ({
  roles,
  departmentId = null,
  status = null,
  limit = 50,
  cursor = null,
} = {}) => {
  if (!Array.isArray(roles) || roles.length === 0) return [];

  const params = [roles];
  const conditions = [`r.role = ANY($1::text[])`];

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`r.department_id = $${params.length}::uuid`);
  }
  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (cursor) {
    params.push(cursor);
    conditions.push(`r.submitted_at < $${params.length}::timestamptz`);
  }

  params.push(limit);
  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const sql = `
    SELECT r.id, r.user_id, r.role, r.status, r.full_name, r.student_id,
           r.department_id, r.course_id, r.year_level, r.birthdate,
           r.submitted_at, r.reviewed_at, r.review_note,
           r.reviewed_by,
           p.email AS user_email,
           d.name AS department_name,
           c.name AS course_name
      FROM public.profile_verification_requests r
      JOIN public.profiles p ON p.id = r.user_id
      LEFT JOIN public.departments d ON d.id = r.department_id
      LEFT JOIN public.courses c ON c.id = r.course_id
      ${whereClause}
      ORDER BY r.submitted_at DESC
      LIMIT $${params.length};
  `;
  const result = await db.query(sql, params);
  return result.rows;
};

/**
 * Profiles who should be told about a request, from the reviewer matrix.
 *
 * `campusRoles` are matched anywhere; `departmentRoles` are matched only inside
 * the requester's department. Suspended accounts are skipped — they cannot act on
 * the request, so telling them is noise.
 */
const resolveReviewers = async ({ campusRoles = [], departmentRoles = [], departmentId = null }) => {
  if (campusRoles.length === 0 && (departmentRoles.length === 0 || !departmentId)) return [];

  const result = await db.query(
    `SELECT p.id, p.full_name, p.username, d.name AS department_name
       FROM public.profiles p
       LEFT JOIN public.departments d ON d.id = p.department_id
      WHERE (p.suspended_at IS NULL OR (p.suspended_until IS NOT NULL AND p.suspended_until <= NOW()))
        AND (
          p.role = ANY($1::text[])
          OR ($2::uuid IS NOT NULL AND p.department_id = $2::uuid AND p.role = ANY($3::text[]))
        );`,
    [campusRoles, departmentId, departmentRoles]
  );
  return result.rows;
};

/**
 * Approve a request in one transaction:
 *   1. lock the row FOR UPDATE; 409 if not pending
 *   2. write the identity fields onto the profile
 *   3. mark the request approved
 *
 * Catalog columns are written with COALESCE: a staff form does not carry a
 * course, and an admin form carries no catalog fields at all, so an absent value
 * must leave whatever the profile already had rather than clearing it.
 *
 * Returns the updated request. The caller is responsible for audit + notify.
 */
const approve = async (id, reviewerId) => {
  return db.withTransaction(async (client) => {
    const result = await client.query(
      `SELECT * FROM public.profile_verification_requests WHERE id = $1::uuid FOR UPDATE;`,
      [id]
    );
    const request = result.rows[0];
    if (!request) {
      const err = new Error("Request not found");
      err.status = 404;
      throw err;
    }
    if (request.status !== "pending") {
      const err = new Error("Request is no longer pending");
      err.status = 409;
      throw err;
    }

    await client.query(
      `UPDATE public.profiles
          SET full_name = $2,
              student_id = $3,
              department_id = COALESCE($4::uuid, department_id),
              course_id = COALESCE($5::uuid, course_id),
              course = CASE
                         WHEN $5::uuid IS NULL THEN course
                         ELSE (SELECT name FROM public.courses WHERE id = $5::uuid)
                       END,
              year_level = COALESCE($6, year_level),
              verification_status = 'verified',
              verified_at = NOW()
        WHERE id = $1;`,
      [
        request.user_id,
        request.full_name,
        request.student_id,
        request.department_id,
        request.course_id,
        request.year_level,
      ]
    );

    const updated = await client.query(
      `UPDATE public.profile_verification_requests
          SET status = 'approved',
              reviewed_by = $2,
              reviewed_at = NOW()
        WHERE id = $1::uuid
        RETURNING *;`,
      [id, reviewerId]
    );
    return updated.rows[0];
  });
};

/**
 * Decline a request in one transaction. The profile stays unverified; the
 * reviewer's note is stored on the request so the requester can fix and resubmit.
 */
const decline = async (id, reviewerId, note) => {
  return db.withTransaction(async (client) => {
    const result = await client.query(
      `SELECT * FROM public.profile_verification_requests WHERE id = $1::uuid FOR UPDATE;`,
      [id]
    );
    const request = result.rows[0];
    if (!request) {
      const err = new Error("Request not found");
      err.status = 404;
      throw err;
    }
    if (request.status !== "pending") {
      const err = new Error("Request is no longer pending");
      err.status = 409;
      throw err;
    }

    const updated = await client.query(
      `UPDATE public.profile_verification_requests
          SET status = 'declined',
              reviewed_by = $2,
              reviewed_at = NOW(),
              review_note = $3
        WHERE id = $1::uuid
        RETURNING *;`,
      [id, reviewerId, note]
    );

    // Back to unverified so the requester can resubmit after fixing the problem.
    await client.query(
      `UPDATE public.profiles SET verification_status = 'unverified' WHERE id = $1;`,
      [request.user_id]
    );

    return updated.rows[0];
  });
};

module.exports = {
  getLatestForUser,
  getById,
  createPending,
  updatePending,
  listQueue,
  resolveReviewers,
  approve,
  decline,
};
