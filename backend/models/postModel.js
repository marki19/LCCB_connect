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
      COALESCE((SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id), 0) AS likes,
      COALESCE((SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id), 0) AS comments,
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
      COALESCE((SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id), 0) AS likes,
      COALESCE((SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id), 0) AS comments,
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

const toggleLike = async (postId, userId) => {
  const checkSql = `SELECT id FROM likes WHERE post_id = $1 AND user_id = $2;`;
  const existing = await db.query(checkSql, [postId, userId]);
  if (existing.rows.length > 0) {
    await db.query(`DELETE FROM likes WHERE post_id = $1 AND user_id = $2;`, [postId, userId]);
    return { liked: false };
  } else {
    await db.query(`INSERT INTO likes (post_id, user_id) VALUES ($1, $2);`, [postId, userId]);
    return { liked: true };
  }
};

const getComments = async (postId) => {
  const sql = `
    SELECT 
      c.id,
      c.post_id,
      c.user_id,
      c.content,
      c.created_at,
      json_build_object(
        'id', pr.id,
        'full_name', pr.full_name,
        'username', pr.username,
        'avatar_url', pr.avatar_url
      ) AS user
    FROM comments c
    LEFT JOIN profiles pr ON c.user_id = pr.id
    WHERE c.post_id = $1
    ORDER BY c.created_at ASC;
  `;
  const result = await db.query(sql, [postId]);
  return result.rows;
};

const addComment = async (postId, userId, content) => {
  const sql = `
    INSERT INTO comments (post_id, user_id, content)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const result = await db.query(sql, [postId, userId, content]);
  return result.rows[0];
};

module.exports = {
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  getComments,
  addComment,
};
