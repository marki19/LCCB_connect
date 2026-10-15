const db = require("../db");

// RAW SQL QUERIES ONLY (NO ORM METHODS)

const getAllUsers = async () => {
  const sql = `SELECT * FROM profiles ORDER BY id ASC;`;
  const result = await db.query(sql);
  return result.rows;
};

const getUserById = async (id) => {
  const sql = `SELECT * FROM profiles WHERE id = $1;`;
  const result = await db.query(sql, [id]);
  return result.rows[0];
};

const createUser = async (userData) => {
  const { id, username, full_name, avatar_url, bio, course, year_level, role } = userData;
  const sql = `
    INSERT INTO profiles (id, username, full_name, avatar_url, bio, course, year_level, role)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
      username = COALESCE(EXCLUDED.username, profiles.username)
    RETURNING *;
  `;
  const values = [id, username, full_name, avatar_url, bio, course, year_level, role || 'student'];
  const result = await db.query(sql, values);
  return result.rows[0];
};

const updateUser = async (id, userData) => {
  const { username, full_name, avatar_url, bio, course, year_level, role, skills } = userData;
  const sql = `
    UPDATE profiles
    SET username = COALESCE($1, username),
        full_name = COALESCE($2, full_name),
        avatar_url = COALESCE($3, avatar_url),
        bio = COALESCE($4, bio),
        course = COALESCE($5, course),
        year_level = COALESCE($6, year_level),
        role = COALESCE($7, role),
        skills = COALESCE($8, skills)
    WHERE id = $9
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
