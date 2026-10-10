const db = require("../db");

// RAW SQL QUERIES FOR POSTS (WITH JOIN FOR AUTHOR INFO)

const getAllPosts = async () => {
  const sql = `
    SELECT 
      p.id,
      p.author_id,
      p.content,
      p.type,
      p.title,
      p.technologies,
      p.github_url,
      p.image_url,
      p.created_at,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'course', pr.course,
        'year_level', pr.year_level
      ) AS author
    FROM posts p
    LEFT JOIN profiles pr ON p.author_id = pr.id
    ORDER BY p.created_at DESC;
  `;
  const result = await db.query(sql);
  return result.rows;
};

const getPostById = async (id) => {
  const sql = `
    SELECT 
      p.id,
      p.author_id,
      p.content,
      p.type,
      p.title,
      p.technologies,
      p.github_url,
      p.image_url,
      p.created_at,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url
      ) AS author
    FROM posts p
    LEFT JOIN profiles pr ON p.author_id = pr.id
    WHERE p.id = $1;
  `;
  const result = await db.query(sql, [id]);
  return result.rows[0];
};

const createPost = async (postData) => {
  const { author_id, content, type, title, technologies, github_url, image_url } = postData;
  const sql = `
    INSERT INTO posts (author_id, content, type, title, technologies, github_url, image_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [
    author_id,
    content,
    type || 'text',
    title || null,
    technologies || null,
    github_url || null,
    image_url || null,
  ];
  const result = await db.query(sql, values);
  return result.rows[0];
};

const updatePost = async (id, postData) => {
  const { content, type, title, technologies, github_url, image_url } = postData;
  const sql = `
    UPDATE posts
    SET content = $1,
        type = $2,
        title = $3,
        technologies = $4,
        github_url = $5,
        image_url = $6
    WHERE id = $7
    RETURNING *;
  `;
  const values = [content, type, title, technologies, github_url, image_url, id];
  const result = await db.query(sql, values);
  return result.rows[0];
};

const deletePost = async (id) => {
  const sql = `DELETE FROM posts WHERE id = $1 RETURNING *;`;
  const result = await db.query(sql, [id]);
  return result.rows[0];
};

module.exports = {
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
};
