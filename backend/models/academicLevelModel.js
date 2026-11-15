const db = require("../db");

const listActive = async () => {
  const result = await db.query(
    "SELECT id, name, code, sort_order, active, created_at FROM academic_levels WHERE active = true ORDER BY sort_order ASC, name ASC"
  );
  return result.rows;
};

const listAll = async () => {
  const result = await db.query(
    "SELECT id, name, code, sort_order, active, created_at FROM academic_levels ORDER BY sort_order ASC, name ASC"
  );
  return result.rows;
};

const getById = async (id) => {
  const result = await db.query(
    "SELECT id, name, code, sort_order, active, created_at FROM academic_levels WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
};

const create = async ({ name, code, sort_order = 0 }) => {
  const generatedCode = code ? code.trim().toUpperCase() : name.trim().toUpperCase().replace(/\s+/g, "_");
  const result = await db.query(
    `INSERT INTO academic_levels (name, code, sort_order, active)
     VALUES ($1, $2, $3, true)
     RETURNING id, name, code, sort_order, active, created_at`,
    [name.trim(), generatedCode, Number(sort_order) || 0]
  );
  return result.rows[0];
};

const update = async (id, { name, code, sort_order, active }) => {
  const updates = [];
  const values = [id];

  if (name !== undefined) {
    values.push(name.trim());
    updates.push(`name = $${values.length}`);
  }
  if (code !== undefined) {
    values.push(code ? code.trim().toUpperCase() : null);
    updates.push(`code = $${values.length}`);
  }
  if (sort_order !== undefined) {
    values.push(Number(sort_order) || 0);
    updates.push(`sort_order = $${values.length}`);
  }
  if (active !== undefined) {
    values.push(Boolean(active));
    updates.push(`active = $${values.length}`);
  }

  if (updates.length === 0) return getById(id);

  const result = await db.query(
    `UPDATE academic_levels
     SET ${updates.join(", ")}
     WHERE id = $1
     RETURNING id, name, code, sort_order, active, created_at`,
    values
  );
  return result.rows[0] || null;
};

const remove = async (id) => {
  const result = await db.query(
    "DELETE FROM academic_levels WHERE id = $1 RETURNING id",
    [id]
  );
  return result.rows[0] || null;
};

module.exports = {
  listActive,
  listAll,
  getById,
  create,
  update,
  remove,
};

