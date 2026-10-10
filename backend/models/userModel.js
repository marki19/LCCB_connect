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
    RETURNING *;
  `;
  const values = [id, username, full_name, avatar_url, bio, course, year_level, role || 'student'];
  const result = await db.query(sql, values);
  return result.rows[0];
};

const updateUser = async (id, userData) => {
  const { username, full_name, avatar_url, bio, course, year_level, role } = userData;
  const sql = `
    UPDATE profiles
    SET username = $1,
        full_name = $2,
        avatar_url = $3,
        bio = $4,
        course = $5,
        year_level = $6,
        role = $7
    WHERE id = $8
    RETURNING *;
  `;
  const values = [username, full_name, avatar_url, bio, course, year_level, role, id];
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
