const db = require("../db");
const { DEFAULT_LIMIT } = require("./pagination");

// RAW SQL QUERIES ONLY (NO ORM METHODS)

// Keyset pagination on the (text) primary key. `cursor` is the last `id` seen.
const getAllUsers = async ({ limit = DEFAULT_LIMIT, cursor = null } = {}) => {
  const params = [];
  const whereClause = cursor ? "WHERE p.id > $1" : "";
  if (cursor) params.push(cursor);
  params.push(limit);

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
    department_id, course_id,
  } = userData;
  const sql = `
    INSERT INTO profiles (id, username, full_name, avatar_url, bio, course, year_level, role, department_id, course_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      username = COALESCE(EXCLUDED.username, profiles.username),
      -- Department/course are CLAIM-ONCE: fill them only while still unset, so a
      -- repeat POST can never move a user into a different department.
      department_id = COALESCE(profiles.department_id, EXCLUDED.department_id),
      course_id = COALESCE(profiles.course_id, EXCLUDED.course_id)
    RETURNING *;
  `;
  const values = [
    id, username, full_name, avatar_url, bio, course, year_level, role || 'student',
    department_id || null, course_id || null,
  ];
  const result = await db.query(sql, values);
  return result.rows[0];
};

const updateUser = async (id, userData) => {
  const {
    username, full_name, avatar_url, bio, course, year_level, role, skills,
    department_id, course_id, message_policy,
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
        message_policy = COALESCE($11, message_policy)
    WHERE id = $12
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

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
