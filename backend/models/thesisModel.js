const db = require("../db");

// RAW SQL QUERIES FOR THESES / MANUSCRIPTS

const getAllTheses = async () => {
  const sql = `
    SELECT 
      t.id,
      t.uploader_id,
      t.title,
      t.abstract,
      t.department,
      t.category,
      t.pdf_url,
      t.created_at,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'course', pr.course,
        'year_level', pr.year_level
      ) AS uploader
    FROM theses t
    LEFT JOIN profiles pr ON t.uploader_id = pr.id
    ORDER BY t.created_at DESC;
  `;
  const result = await db.query(sql);
  return result.rows;
};

const getThesisById = async (id) => {
  const sql = `
    SELECT 
      t.id,
      t.uploader_id,
      t.title,
      t.abstract,
      t.department,
      t.category,
      t.pdf_url,
      t.created_at,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url
      ) AS uploader
    FROM theses t
    LEFT JOIN profiles pr ON t.uploader_id = pr.id
    WHERE t.id = $1;
  `;
  const result = await db.query(sql, [id]);
  return result.rows[0];
};

const createThesis = async (thesisData) => {
  const { uploader_id, title, abstract, department, category, pdf_url } = thesisData;
  const sql = `
    INSERT INTO theses (uploader_id, title, abstract, department, category, pdf_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [uploader_id, title, abstract, department, category, pdf_url];
  const result = await db.query(sql, values);
  return result.rows[0];
};

const updateThesis = async (id, thesisData) => {
  const { title, abstract, department, category, pdf_url } = thesisData;
  const sql = `
    UPDATE theses
    SET title = $1,
        abstract = $2,
        department = $3,
        category = $4,
        pdf_url = $5
    WHERE id = $6
    RETURNING *;
  `;
  const values = [title, abstract, department, category, pdf_url, id];
  const result = await db.query(sql, values);
  return result.rows[0];
};

const deleteThesis = async (id) => {
  const sql = `DELETE FROM theses WHERE id = $1 RETURNING *;`;
  const result = await db.query(sql, [id]);
  return result.rows[0];
};

module.exports = {
  getAllTheses,
  getThesisById,
  createThesis,
  updateThesis,
  deleteThesis,
};
