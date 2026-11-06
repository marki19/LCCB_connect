const db = require("../db");
const { DEFAULT_LIMIT } = require("./pagination");
const { escapeLike } = require("../utils/queryFilters");

// RAW SQL QUERIES ONLY (NO ORM METHODS)

// Keyset pagination on the (text) primary key. `cursor` is the last `id` seen.
const getAllUsers = async ({
  limit = DEFAULT_LIMIT,
  cursor = null,
  q = null,
  departmentId = null,
  yearLevel = null,
} = {}) => {
  const params = [];
  const conditions = [];

  if (cursor) {
    params.push(cursor);
    conditions.push(`p.id > $${params.length}`);
  }

  if (q) {
    params.push(`%${escapeLike(q)}%`);
    conditions.push(`(
      p.username ILIKE $${params.length} ESCAPE '!'
      OR p.full_name ILIKE $${params.length} ESCAPE '!'
      OR d.name ILIKE $${params.length} ESCAPE '!'
    )`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`p.department_id = $${params.length}::uuid`);
  }

  if (yearLevel) {
    params.push(yearLevel);
    conditions.push(`p.year_level = $${params.length}`);
  }

  params.push(limit);
  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  // Joins the catalog so callers can display department/course names without a
  // second round-trip. The ids remain the authorization source of truth.
  const sql = `
    SELECT p.*, d.name AS department_name, c.name AS course_name
    FROM profiles p
    LEFT JOIN public.departments d ON d.id = p.department_id
    LEFT JOIN public.courses c ON c.id = p.course_id
    ${whereClause}
    ORDER BY p.id ASC
    LIMIT $${params.length};
  `;
  const result = await db.query(sql, params);
  return result.rows;
};

const getUserById = async (id) => {
  // Joins the catalog so callers can display department/course names without a
  // second round-trip. The ids remain the authorization source of truth.
  const sql = `
    SELECT p.*, d.name AS department_name, c.name AS course_name
    FROM profiles p
    LEFT JOIN public.departments d ON d.id = p.department_id
    LEFT JOIN public.courses c ON c.id = p.course_id
    WHERE p.id = $1;
  `;
  const result = await db.query(sql, [id]);
  return result.rows[0];
};

const createUser = async (userData) => {
  const {
    id, username, full_name, avatar_url, bio, course, year_level, role,
    department_id, course_id, email,
  } = userData;
  const sql = `
    INSERT INTO profiles (id, username, full_name, avatar_url, bio, course, year_level, role, department_id, course_id, email)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      username = COALESCE(EXCLUDED.username, profiles.username),
      -- Department/course are CLAIM-ONCE: fill them only while still unset, so a
      -- repeat POST can never move a user into a different department.
      department_id = COALESCE(profiles.department_id, EXCLUDED.department_id),
      course_id = COALESCE(profiles.course_id, EXCLUDED.course_id),
      -- The signup address is authoritative; a repeat self-provision must not
      -- clobber a corrected one.
      email = COALESCE(EXCLUDED.email, profiles.email)
    RETURNING *;
  `;
  const values = [
    id, username, full_name, avatar_url, bio, course, year_level, role || 'student',
    department_id || null, course_id || null, email || null,
  ];
  const result = await db.query(sql, values);
  return result.rows[0];
};

const updateUser = async (id, userData) => {
  const {
    username, full_name, avatar_url, bio, course, year_level, role, skills,
    department_id, course_id, message_policy, student_id, verification_status,
  } = userData;
  const sql = `
    UPDATE profiles
    SET username = COALESCE($1, username),
        full_name = COALESCE($2, full_name),
        avatar_url = COALESCE($3, avatar_url),
        bio = COALESCE($4, bio),
        course = COALESCE($5, course),
        year_level = COALESCE($6, year_level),
        role = COALESCE($7, role),
        skills = COALESCE($8, skills),
        department_id = COALESCE($9, department_id),
        course_id = COALESCE($10, course_id),
        message_policy = COALESCE($11, message_policy),
        student_id = COALESCE($12, student_id),
        verification_status = COALESCE($13, verification_status)
    WHERE id = $14
    RETURNING *;
  `;
  const values = [
    username || null,
    full_name || null,
    avatar_url || null,
    bio || null,
    course || null,
    year_level || null,
    role || null,
    skills || null,
    department_id || null,
    course_id || null,
    message_policy || null,
    student_id || null,
    verification_status || null,
    id,
  ];
  const result = await db.query(sql, values);
  return result.rows[0];
};

const deleteUser = async (id) => {
  const sql = `DELETE FROM profiles WHERE id = $1 RETURNING *;`;
  const result = await db.query(sql, [id]);
  return result.rows[0];
};

/**
 * Resolves the email behind a student ID so the login route can hand Supabase
 * an email it understands. Only verified owners resolve: an unverified or
 * declined ID must not be a usable login handle.
 *
 * Returns `{ id, email }` or null. The route logs the attempt server-side and
 * always answers the same way whether the ID is unknown or the caller is
 * unverified, so the response cannot be used to enumerate accounts.
 */
const getLoginEmailByStudentId = async (studentId) => {
  const sql = `
    SELECT id, email
    FROM public.profiles
    WHERE upper(student_id) = $1
      AND verification_status = 'verified'
      AND email IS NOT NULL
    LIMIT 1;
  `;
  const result = await db.query(sql, [String(studentId).toUpperCase()]);
  return result.rows[0] || null;
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getLoginEmailByStudentId,
};
