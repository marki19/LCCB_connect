const db = require("../db");
const { DEFAULT_LIMIT } = require("./pagination");

// RAW SQL QUERIES FOR POSTS (WITH JOIN FOR AUTHOR INFO)

// Keyset pagination. Pass `cursor` = "<created_at>|<id>" of the last row you saw.
const getAllPosts = async ({ limit = DEFAULT_LIMIT, cursor = null, includeHidden = false } = {}) => {
  const params = [];
  const conditions = [];

  if (!includeHidden) {
    conditions.push("p.moderation_status != 'hidden'");
  }

  if (cursor) {
    const [createdAt, id] = String(cursor).split("|");
    if (createdAt && id) {
      params.push(createdAt, id);
      conditions.push(`(
        p.created_at < $${params.length - 1}::timestamptz
        OR (p.created_at = $${params.length - 1}::timestamptz AND p.id < $${params.length}::uuid)
      )`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);

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
      p.preview_metadata,
      p.moderation_status,
      p.moderation_reason,
      p.created_at,
      COALESCE((SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id), 0) AS likes,
      COALESCE((SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id AND c.moderation_status != 'hidden'), 0) AS comments,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'course', pr.course,
        'year_level', pr.year_level,
        'department_id', pr.department_id,
        'department_name', d.name
      ) AS author
    FROM posts p
    LEFT JOIN profiles pr ON p.author_id = pr.id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    ${whereClause}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT $${params.length};
  `;
  const result = await db.query(sql, params);
  return result.rows;
};

const getPostById = async (id, { includeHidden = false } = {}) => {
  const params = [id];
  let hiddenFilter = "";
  if (!includeHidden) {
    hiddenFilter = "AND p.moderation_status != 'hidden'";
  }

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
      p.preview_metadata,
      p.moderation_status,
      p.moderation_reason,
      p.created_at,
      COALESCE((SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id), 0) AS likes,
      COALESCE((SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id AND c.moderation_status != 'hidden'), 0) AS comments,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'course', pr.course,
        'year_level', pr.year_level,
        'department_id', pr.department_id,
        'department_name', d.name
      ) AS author
    FROM posts p
    LEFT JOIN profiles pr ON p.author_id = pr.id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE p.id = $1 ${hiddenFilter};
  `;
  const result = await db.query(sql, params);
  return result.rows[0];
};

const createPost = async (postData) => {
  const {
    author_id,
    content,
    type,
    title,
    technologies,
    github_url,
    image_url,
    preview_metadata = null,
    moderation_status = 'approved',
    moderation_reason = null,
  } = postData;
  const sql = `
    INSERT INTO posts (author_id, content, type, title, technologies, github_url, image_url, preview_metadata, moderation_status, moderation_reason)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
    preview_metadata ? JSON.stringify(preview_metadata) : null,
    moderation_status,
    moderation_reason,
  ];
  const result = await db.query(sql, values);
  return result.rows[0];
};

const POST_UPDATABLE_COLUMNS = [
  "content",
  "type",
  "title",
  "technologies",
  "github_url",
  "image_url",
  "preview_metadata",
];

const updatePost = async (id, authorId, postData) => {
  const fields = POST_UPDATABLE_COLUMNS.filter(
    (column) => postData[column] !== undefined
  );

  if (fields.length === 0) {
    const current = await db.query(
      `SELECT * FROM posts WHERE id = $1 AND author_id = $2;`,
      [id, authorId]
    );
    return current.rows[0];
  }

  const setClause = fields.map((column, i) => `${column} = $${i + 1}`).join(", ");
  const values = fields.map((column) => postData[column]);
  values.push(id, authorId);

  const sql = `
    UPDATE posts
    SET ${setClause}
    WHERE id = $${fields.length + 1} AND author_id = $${fields.length + 2}
    RETURNING *;
  `;
  const result = await db.query(sql, values);
  return result.rows[0];
};

const deletePost = async (id, authorId) => {
  const sql = `DELETE FROM posts WHERE id = $1 AND author_id = $2 RETURNING *;`;
  const result = await db.query(sql, [id, authorId]);
  return result.rows[0];
};

const adminDeletePost = async (id) => {
  const sql = `DELETE FROM posts WHERE id = $1 RETURNING *;`;
  const result = await db.query(sql, [id]);
  return result.rows[0];
};

const toggleLike = async (postId, userId) => {
  const inserted = await db.query(
    `INSERT INTO likes (post_id, user_id) VALUES ($1, $2)
     ON CONFLICT (post_id, user_id) DO NOTHING
     RETURNING id;`,
    [postId, userId]
  );
  if (inserted.rowCount > 0) {
    return { liked: true };
  }
  await db.query(`DELETE FROM likes WHERE post_id = $1 AND user_id = $2;`, [postId, userId]);
  return { liked: false };
};

const getComments = async (postId, { includeHidden = false } = {}) => {
  const hiddenFilter = includeHidden ? "" : "AND c.moderation_status != 'hidden'";
  const sql = `
    SELECT 
      c.id,
      c.post_id,
      c.user_id,
      c.content,
      c.moderation_status,
      c.moderation_reason,
      c.created_at,
      json_build_object(
        'id', pr.id,
        'full_name', pr.full_name,
        'username', pr.username,
        'avatar_url', pr.avatar_url,
        'course', pr.course,
        'department_id', pr.department_id,
        'department_name', d.name
      ) AS user
    FROM comments c
    LEFT JOIN profiles pr ON c.user_id = pr.id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE c.post_id = $1 ${hiddenFilter}
    ORDER BY c.created_at ASC;
  `;
  const result = await db.query(sql, [postId]);
  return result.rows;
};

// Single comment, with the commenter's profile — used for moderation scoping.
// `author.department_id` matches how `getFlaggedComments` filters the queue.
const getCommentById = async (id) => {
  const sql = `
    SELECT
      c.id,
      c.post_id,
      c.user_id,
      c.content,
      c.moderation_status,
      c.moderation_reason,
      c.created_at,
      json_build_object(
        'id', pr.id,
        'full_name', pr.full_name,
        'username', pr.username,
        'avatar_url', pr.avatar_url,
        'course', pr.course,
        'department_id', pr.department_id,
        'department_name', d.name
      ) AS author
    FROM comments c
    LEFT JOIN profiles pr ON c.user_id = pr.id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE c.id = $1;
  `;
  const result = await db.query(sql, [id]);
  return result.rows[0];
};

const addComment = async (postId, userId, content, { moderation_status = 'approved', moderation_reason = null } = {}) => {
  const sql = `
    INSERT INTO comments (post_id, user_id, content, moderation_status, moderation_reason)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const result = await db.query(sql, [postId, userId, content, moderation_status, moderation_reason]);
  return result.rows[0];
};

// ---- MODERATION SPECIFIC QUERIES -------------------------------------------

const getFlaggedPosts = async ({ departmentId = null } = {}) => {
  const params = [];
  let deptCondition = "";

  if (departmentId) {
    params.push(departmentId);
    deptCondition = `AND pr.department_id = $1::uuid`;
  }

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
      p.moderation_status,
      p.moderation_reason,
      p.created_at,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'course', pr.course,
        'year_level', pr.year_level,
        'department_id', pr.department_id,
        'department_name', d.name
      ) AS author
    FROM posts p
    LEFT JOIN profiles pr ON p.author_id = pr.id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE p.moderation_status = 'flagged' ${deptCondition}
    ORDER BY p.created_at DESC;
  `;
  const result = await db.query(sql, params);
  return result.rows;
};

const getFlaggedComments = async ({ departmentId = null } = {}) => {
  const params = [];
  let deptCondition = "";

  if (departmentId) {
    params.push(departmentId);
    deptCondition = `AND pr.department_id = $1::uuid`;
  }

  const sql = `
    SELECT 
      c.id,
      c.post_id,
      c.user_id,
      c.content,
      c.moderation_status,
      c.moderation_reason,
      c.created_at,
      p.title AS post_title,
      json_build_object(
        'id', pr.id,
        'full_name', pr.full_name,
        'username', pr.username,
        'avatar_url', pr.avatar_url,
        'course', pr.course,
        'department_id', pr.department_id,
        'department_name', d.name
      ) AS author
    FROM comments c
    LEFT JOIN profiles pr ON c.user_id = pr.id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    LEFT JOIN posts p ON c.post_id = p.id
    WHERE c.moderation_status = 'flagged' ${deptCondition}
    ORDER BY c.created_at DESC;
  `;
  const result = await db.query(sql, params);
  return result.rows;
};

const updatePostModeration = async (id, status, reason = null) => {
  const sql = `
    UPDATE posts
    SET moderation_status = $1, moderation_reason = $2
    WHERE id = $3
    RETURNING *;
  `;
  const result = await db.query(sql, [status, reason, id]);
  return result.rows[0];
};

const updateCommentModeration = async (id, status, reason = null) => {
  const sql = `
    UPDATE comments
    SET moderation_status = $1, moderation_reason = $2
    WHERE id = $3
    RETURNING *;
  `;
  const result = await db.query(sql, [status, reason, id]);
  return result.rows[0];
};

const deleteComment = async (id) => {
  const sql = `DELETE FROM comments WHERE id = $1 RETURNING *;`;
  const result = await db.query(sql, [id]);
  return result.rows[0];
};

module.exports = {
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  adminDeletePost,
  toggleLike,
  getComments,
  getCommentById,
  addComment,
  getFlaggedPosts,
  getFlaggedComments,
  updatePostModeration,
  updateCommentModeration,
  deleteComment,
};
