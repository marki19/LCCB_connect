const db = require("../db");

/**
 * Guest / Outsider Access Model
 * Handles guest declaration requests and administrative approval/decline.
 */

const createRequest = async (userId, { purpose, affiliationType, affiliationName, location }) => {
  return db.withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO public.guest_access_requests (user_id, purpose, affiliation_type, affiliation_name, location)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [userId, purpose, affiliationType, affiliationName, location || null]
    );

    await client.query(
      `UPDATE public.profiles
          SET role = 'guest',
              verification_status = 'pending',
              guest_declared_at = NOW(),
              guest_purpose = $2,
              guest_affiliation_type = $3,
              guest_affiliation_name = $4,
              guest_location = $5
        WHERE id = $1;`,
      [userId, purpose, affiliationType, affiliationName, location || null]
    );

    return res.rows[0];
  });
};

const getPendingForUser = async (userId) => {
  const res = await db.query(
    `SELECT * FROM public.guest_access_requests
      WHERE user_id = $1 AND status = 'pending'
      ORDER BY submitted_at DESC
      LIMIT 1;`,
    [userId]
  );
  return res.rows[0] || null;
};

const getById = async (id) => {
  const res = await db.query(
    `SELECT g.*, p.username, p.full_name, p.avatar_url, p.email
       FROM public.guest_access_requests g
       JOIN public.profiles p ON p.id = g.user_id
      WHERE g.id = $1::uuid;`,
    [id]
  );
  return res.rows[0] || null;
};

const listRequests = async ({ status = "pending", limit = 50 } = {}) => {
  const res = await db.query(
    `SELECT g.*, p.username, p.full_name, p.avatar_url, p.email
       FROM public.guest_access_requests g
       JOIN public.profiles p ON p.id = g.user_id
      WHERE ($1::text IS NULL OR g.status = $1)
      ORDER BY g.submitted_at DESC
      LIMIT $2;`,
    [status, limit]
  );
  return res.rows;
};

const approve = async (id, decidedBy, note = null) => {
  return db.withTransaction(async (client) => {
    const check = await client.query(
      `SELECT * FROM public.guest_access_requests WHERE id = $1::uuid FOR UPDATE;`,
      [id]
    );
    const request = check.rows[0];
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
      `UPDATE public.guest_access_requests
          SET status = 'approved',
              decided_at = NOW(),
              decided_by = $2,
              decision_note = $3
        WHERE id = $1::uuid
        RETURNING *;`,
      [id, decidedBy, note]
    );

    await client.query(
      `UPDATE public.profiles
          SET role = 'guest',
              verification_status = 'verified',
              guest_purpose = $2,
              guest_affiliation_type = $3,
              guest_affiliation_name = $4,
              guest_location = $5
        WHERE id = $1;`,
      [
        request.user_id,
        request.purpose,
        request.affiliation_type,
        request.affiliation_name,
        request.location,
      ]
    );

    return updated.rows[0];
  });
};

const decline = async (id, decidedBy, note = null) => {
  return db.withTransaction(async (client) => {
    const check = await client.query(
      `SELECT * FROM public.guest_access_requests WHERE id = $1::uuid FOR UPDATE;`,
      [id]
    );
    const request = check.rows[0];
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
      `UPDATE public.guest_access_requests
          SET status = 'declined',
              decided_at = NOW(),
              decided_by = $2,
              decision_note = $3
        WHERE id = $1::uuid
        RETURNING *;`,
      [id, decidedBy, note]
    );

    await client.query(
      `UPDATE public.profiles
          SET verification_status = 'declined',
              suspended_at = NOW(),
              suspended_by = $2,
              suspended_until = NULL
        WHERE id = $1;`,
      [request.user_id, decidedBy]
    );

    return updated.rows[0];
  });
};

module.exports = {
  createRequest,
  getPendingForUser,
  getById,
  listRequests,
  approve,
  decline,
};
