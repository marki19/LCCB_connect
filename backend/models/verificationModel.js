const db = require("../db");

// RAW SQL ONLY (NO ORM METHODS).

/**
 * One approval per request. The student submits a snapshot; the reviewer never
 * reads the live profile, so an edit made mid-review cannot change what is
 * being approved.
 *
 * The unique partial index `uq_verification_one_pending` (migration 016) lets us
 * treat a duplicate submit as a conflict instead of a second row.
 */

/** Latest request for a user, or null. Joins department/course names and selects r.* including birthdate. */
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

/**
 * Inserts a pending request. The partial unique index on
 * `user_id WHERE status = 'pending'` turns a duplicate into `23505`,
 * which the controller maps to 409.
 */
const createPending = async (userId, snapshot) => {
  const result = await db.query(
    `INSERT INTO public.profile_verification_requests
       (user_id, full_name, student_id, department_id, course_id, year_level, birthdate)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *;`,
    [
      userId,
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
        SET full_name = $2,
            student_id = $3,
            department_id = $4,
            course_id = $5,
            year_level = $6,
            birthdate = $7,
            submitted_at = NOW()
      WHERE user_id = $1 AND status = 'pending'
      RETURNING *;`,
    [
      userId,
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
 * `departmentId` filters by the request's department; `status` filters by
 * request status. Cursor is the last `submitted_at` seen (keyset pagination
 * on a timestamp column).
 */
const listQueue = async ({ departmentId = null, status = null, limit = 50, cursor = null } = {}) => {
  const params = [];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (departmentId) {
    params.push(departmentId);
    conditions.push(`r.department_id = $${params.length}::uuid`);
  }
  if (cursor) {
    params.push(cursor);
    conditions.push(`r.submitted_at < $${params.length}::timestamptz`);
  }

  params.push(limit);
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT r.id, r.user_id, r.status, r.full_name, r.student_id,
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
 * Approve a request in one transaction:
 *   1. lock the row FOR UPDATE; 409 if not pending
 *   2. write the identity fields onto the profile
 *   3. mark the request approved
 *
 * Returns the updated request. The caller is responsible for audit + notify.
 */
const approve = async (id, reviewerId, client) => {
  const result = await client.query(
    `SELECT * FROM public.profile_verification_requests WHERE id = $1 FOR UPDATE;`,
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
            department_id = $4,
            course_id = $5,
            course = (SELECT name FROM public.courses WHERE id = $5),
            year_level = $6,
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
      WHERE id = $1
      RETURNING *;`,
    [id, reviewerId]
  );
  return updated.rows[0];
};

/**
 * Decline a request in one transaction. The profile stays unverified; the
 * reviewer's note is stored on the request so the student can fix and resubmit.
 */
const decline = async (id, reviewerId, note, client) => {
  const result = await client.query(
    `SELECT * FROM public.profile_verification_requests WHERE id = $1 FOR UPDATE;`,
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
            review_note = $4
      WHERE id = $1
      RETURNING *;`,
    [id, reviewerId, null, note]
  );
  return updated.rows[0];
};

module.exports = {
  getLatestForUser,
  createPending,
  updatePending,
  listQueue,
  approve,
  decline,
};