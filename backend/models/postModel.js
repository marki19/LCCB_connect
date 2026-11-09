const db = require("../db");
const { DEFAULT_LIMIT } = require("./pagination");
const { escapeLike } = require("../utils/queryFilters");

// RAW SQL QUERIES FOR POSTS (WITH JOIN FOR AUTHOR INFO)

// Keyset pagination. Pass `cursor` = "<created_at>|<id>" of the last row you saw.
// Optionally pass `userId` to include `is_liked` for the current user.
//
// `userId` doubles as the visibility viewer. When `includeHidden` is false the
// read goes through `visible_posts()`, the single copy of the visibility rule
// (public / friends / custom / private). Moderation callers pass
// `includeHidden: true` and read the base table, because a moderator who cannot
// see a hidden or private row cannot moderate it.
const getAllPosts = async ({
  limit = DEFAULT_LIMIT,
  cursor = null,
  includeHidden = false,
  q = null,
  authorId = null,
  userId = null,
} = {}) => {
  const params = [];
  const conditions = [];

  if (q) {
    params.push(`%${escapeLike(q)}%`);
    conditions.push(`(
      p.title ILIKE $${params.length} ESCAPE '!'
      OR p.content ILIKE $${params.length} ESCAPE '!'
    )`);
  }

  if (authorId) {
    params.push(authorId);
    conditions.push(`p.author_id = $${params.length}::text`);
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

  // The viewer is appended last so the filter indexes above stay stable.
  let fromClause = "FROM posts p";
  if (!includeHidden) {
    params.push(userId);
    fromClause = `FROM visible_posts($${params.length}::text) p`;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);

  // Build the is_liked subquery if userId is provided
  const isLikedSubquery = userId
    ? `, (SELECT EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $${params.length + 1})) AS is_liked`
    : "";

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
      p.visibility,
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
      ${isLikedSubquery}
    ${fromClause}
    LEFT JOIN profiles pr ON p.author_id = pr.id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    ${whereClause}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT $${params.length};
  `;
  
  const queryParams = userId ? [...params, userId] : params;
  const result = await db.query(sql, queryParams);
  return result.rows;
};

// `viewerId` gates which posts exist at all; `includeHidden` is the moderation
// escape hatch that reads the base table instead.
const getPostById = async (id, { includeHidden = false, userId = null } = {}) => {
  const params = [id];

  let fromClause = "FROM posts p";
  if (!includeHidden) {
    params.push(userId);
    fromClause = `FROM visible_posts($${params.length}::text) p`;
  }

  // Build the is_liked subquery if userId is provided
  const isLikedSubquery = userId
    ? `, (SELECT EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $${params.length + 1})) AS is_liked`
    : "";

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
      p.visibility,
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
      ${isLikedSubquery}
    ${fromClause}
    LEFT JOIN profiles pr ON p.author_id = pr.id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE p.id = $1;
  `;
  const result = await db.query(sql, userId ? [...params, userId] : params);
  return result.rows[0];
};


// ---- visibility + audience -------------------------------------------------

/**
 * Replaces the custom audience list for a post. Takes the caller's transaction
 * client so the post write and its audience list commit together.
 */
const setPostAudience = async (client, postId, userIds) => {
  await client.query("DELETE FROM public.post_audience WHERE post_id = $1::uuid", [
    postId,
  ]);
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  await client.query(
    `INSERT INTO public.post_audience (post_id, user_id)
     SELECT $1::uuid, unnest($2::text[])
     ON CONFLICT DO NOTHING;`,
    [postId, userIds]
  );
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
    visibility = 'public',
    audience = null,
  } = postData;

  return db.withTransaction(async (client) => {
    const sql = `
      INSERT INTO posts (author_id, content, type, title, technologies, github_url, image_url, preview_metadata, moderation_status, moderation_reason, visibility)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
      visibility,
    ];
    const result = await client.query(sql, values);
    const post = result.rows[0];
    // A non-custom post stores no audience; a custom one must.
    if (post.visibility === 'custom') {
      await setPostAudience(client, post.id, audience);
    }
    return post;
  });
};

const POST_UPDATABLE_COLUMNS = [
  "content",
  "type",
  "title",
  "technologies",
  "github_url",
  "image_url",
  "preview_metadata",
  "visibility",
];

// Partial update. Ownership is enforced in SQL, and the audience list is only
// touched when the caller actually sent `visibility`/`audience` - otherwise an
// unrelated edit (a title change) would silently wipe the custom list.
const updatePost = async (id, authorId, postData) => {
  const fields = POST_UPDATABLE_COLUMNS.filter(
    (column) => postData[column] !== undefined
  );
  const touchesAudience =
    postData.audience !== undefined || postData.visibility !== undefined;

  if (fields.length === 0 && !touchesAudience) {
    const current = await db.query(
      `SELECT * FROM posts WHERE id = $1 AND author_id = $2;`,
      [id, authorId]
    );
    return current.rows[0];
  }

  return db.withTransaction(async (client) => {
    let post;

    if (fields.length > 0) {
      const setClause = fields.map((column, i) => `${column} = $${i + 1}`).join(", ");
      const values = fields.map((column) => postData[column]);
      values.push(id, authorId);

      const result = await client.query(
        `
          UPDATE posts
          SET ${setClause}
          WHERE id = $${fields.length + 1} AND author_id = $${fields.length + 2}
          RETURNING *;
        `,
        values
      );
      post = result.rows[0];
    } else {
      const current = await client.query(
        `SELECT * FROM posts WHERE id = $1 AND author_id = $2;`,
        [id, authorId]
      );
      post = current.rows[0];
    }

    // No row means the caller does not own the post (or it is gone) -> 404.
    // Return before touching the audience list.
    if (!post) return undefined;

    if (post.visibility === 'custom') {
      if (postData.audience !== undefined) {
        await setPostAudience(client, post.id, postData.audience);
      }
    } else {
      await setPostAudience(client, post.id, []);
    }

    return post;
  });
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

// `viewerId` gates the comments on the parent post's visibility, so the rule
// still holds if a caller ever reaches this without first loading the post.
// Moderation passes `includeHidden: true` and skips the gate.
const getComments = async (postId, { includeHidden = false, viewerId = null } = {}) => {
  const hiddenFilter = includeHidden ? "" : "AND c.moderation_status != 'hidden'";
  const visibilityJoin = includeHidden
    ? ""
    : `AND EXISTS (SELECT 1 FROM visible_posts($2::text) vp WHERE vp.id = c.post_id)`;
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
    WHERE c.post_id = $1 ${hiddenFilter} ${visibilityJoin}
    ORDER BY c.created_at ASC;
  `;
  const params = includeHidden ? [postId] : [postId, viewerId];
  const result = await db.query(sql, params);
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
      p.visibility,
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

// ---- AUTHOR-SCOPED COMMENT WRITES ------------------------------------------
// Ownership is enforced in SQL: an edit/delete only matches when the caller is
// the comment's author (and, for the edit, the comment is still attached to the
// post in the path). A caller who does not own the comment gets no row back,
// which the controller turns into a 404 — same convention as post/thesis writes.
//
// An edit resets the moderation status and re-runs the scanner (see the
// controller), mirroring comment creation. A moderator-hidden comment cannot
// be edited by its author (`moderation_status != 'hidden'`), so a hide cannot
// be edited away.

const updateCommentByAuthor = async (id, postId, userId, content) => {
  const sql = `
    UPDATE comments
    SET content = $1, moderation_status = 'approved', moderation_reason = NULL
    WHERE id = $2 AND post_id = $3 AND user_id = $4 AND moderation_status != 'hidden'
    RETURNING *;
  `;
  const result = await db.query(sql, [content, id, postId, userId]);
  return result.rows[0];
};

const deleteCommentByAuthor = async (id, postId, userId) => {
  const sql = `
    DELETE FROM comments
    WHERE id = $1 AND post_id = $2 AND user_id = $3
    RETURNING *;
  `;
  const result = await db.query(sql, [id, postId, userId]);
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
  updateCommentByAuthor,
  deleteCommentByAuthor,
};
