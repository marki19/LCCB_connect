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
  departmentId = null,
  courseId = null,
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

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`(p.author_department_id = $${params.length}::uuid OR pr.department_id = $${params.length}::uuid)`);
  }

  if (courseId) {
    params.push(courseId);
    conditions.push(`(p.author_course_id = $${params.length}::uuid OR pr.course_id = $${params.length}::uuid)`);
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

  // Build the is_liked and is_saved subqueries if userId is provided
  const isLikedSubquery = userId
    ? `, (SELECT EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $${params.length + 1})) AS is_liked,
         (SELECT EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $${params.length + 1})) AS is_saved`
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
      p.image_urls,
      p.image_urls,
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

  // Build the is_liked and is_saved subqueries if userId is provided
  const isLikedSubquery = userId
    ? `, (SELECT EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $${params.length + 1})) AS is_liked,
         (SELECT EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $${params.length + 1})) AS is_saved`
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
      p.image_urls,
      p.image_urls,
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


// =============================================================================
// UNIFIED VISIBILITY FUNCTION — SINGLE SOURCE OF TRUTH
// =============================================================================
// Replaces getAllPosts/getPostById as the primary read path.
// Returns { posts: [] } merged with reposts and sorted by created_at.
// All visibility enforcement happens in the database via visible_posts() and
// visible_reposts_for_post(). No code path should query `posts` directly
// without going through this function (except moderation with includeHidden).
// =============================================================================

const POST_TYPE_FILTERS = [
  'text', 'image', 'website', 'project', 'capstone', 'dissertation', 'discussion'
];

const buildPostSelect = (paramsLength, viewerId) => {
  const isLikedSubquery = viewerId
    ? `, (SELECT EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $${paramsLength + 1})) AS is_liked`
    : "";
  return `
    SELECT
      p.id,
      p.author_id,
      p.content,
      p.type,
      p.title,
      p.technologies,
      p.github_url,
      p.image_url,
      p.image_urls,
      p.image_urls,
      p.preview_metadata,
      p.visibility,
      p.allow_reposts,
      p.author_department_id,
      p.author_course_id,
      p.repost_count,
      p.deleted_at,
      p.edited_at,
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
  `;
};

const buildRepostSelect = (paramsLength, viewerId) => {
  const isLikedSubquery = viewerId
    ? `, (SELECT EXISTS(SELECT 1 FROM likes l WHERE l.post_id = r.original_post_id AND l.user_id = $${paramsLength + 1})) AS is_liked`
    : "";
  return `
    SELECT
      r.id AS repost_id,
      r.reposter_id,
      r.original_post_id,
      r.caption AS repost_caption,
      r.visibility AS repost_visibility,
      r.created_at AS repost_created_at,
      r.deleted_at AS repost_deleted_at,
      p.id,
      p.author_id,
      p.content,
      p.type,
      p.title,
      p.technologies,
      p.github_url,
      p.image_url,
      p.image_urls,
      p.image_urls,
      p.preview_metadata,
      p.visibility,
      p.allow_reposts,
      p.author_department_id,
      p.author_course_id,
      p.repost_count,
      p.deleted_at,
      p.edited_at,
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
  `;
};

/**
 * Single unified function for reading posts with visibility enforcement.
 * Used by: feed, profile, search, direct link, notifications, repost embeds, counts.
 * 
 * @param {Object} options
 * @param {string|null} options.viewerId - User ID for visibility gating (null for guests)
 * @param {number} options.limit - Max rows to return (clamped to 1-100)
 * @param {string|null} options.cursor - Keyset cursor "created_at|id"
 * @param {string|null} options.q - Search term (title/content)
 * @param {string|null} options.authorId - Filter by author
 * @param {string|null} options.type - Filter by post type (text, image, website, project, capstone, dissertation, discussion)
 * @param {boolean} options.includeReposts - Whether to include reposts in results
 * @param {boolean} options.includeHidden - Moderation escape hatch (reads base tables)
 * @returns {Promise<{posts: Array}>}
 */
const visiblePostsFor = async ({
  viewerId = null,
  limit = DEFAULT_LIMIT,
  cursor = null,
  q = null,
  authorId = null,
  departmentId = null,
  courseId = null,
  type = null,
  visibility = null,
  postId = null,
  includeReposts = true,
  includeHidden = false,
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

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`(p.author_department_id = $${params.length}::uuid OR pr.department_id = $${params.length}::uuid)`);
  }

  if (courseId) {
    params.push(courseId);
    conditions.push(`(p.author_course_id = $${params.length}::uuid OR pr.course_id = $${params.length}::uuid)`);
  }

  if (type && POST_TYPE_FILTERS.includes(type)) {
      params.push(type);
      conditions.push(`p.type = $${params.length}`);
    }

    if (visibility && ['public', 'friends', 'private', 'custom'].includes(visibility)) {
      params.push(visibility);
      conditions.push(`p.visibility = $${params.length}`);
    }

    if (postId) {
      params.push(postId);
      conditions.push(`p.id = $${params.length}::uuid`);
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

  // ---- 1. Fetch visible posts ------------------------------------------------
  const postParams = [...params];
  let fromClausePosts = "FROM posts p";
  if (!includeHidden) {
    postParams.push(viewerId);
    fromClausePosts = `FROM visible_posts($${postParams.length}::text) p`;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  postParams.push(limit);

  const postSelect = buildPostSelect(postParams.length, viewerId);
  const postsSql = `
    ${postSelect}
    ${fromClausePosts}
    LEFT JOIN profiles pr ON p.author_id = pr.id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    ${whereClause}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT $${postParams.length};
  `;

  const postQueryParams = viewerId ? [...postParams, viewerId] : postParams;
  const postsResult = await db.query(postsSql, postQueryParams);

  // ---- 2. Fetch visible reposts (if requested) -------------------------------
  let reposts = [];
  if (includeReposts) {
    const repostParams = [...params];
    let fromClauseReposts = `
      FROM reposts r
      JOIN posts p ON p.id = r.original_post_id
    `;
    if (!includeHidden) {
      repostParams.push(viewerId);
      fromClauseReposts = `
        FROM visible_reposts($${repostParams.length}::text) r
        JOIN posts p ON p.id = r.original_post_id
      `;
    }

    const repostWhereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    repostParams.push(limit);

    const repostSelect = buildRepostSelect(repostParams.length, viewerId);
    const repostsSql = `
      ${repostSelect}
      ${fromClauseReposts}
      LEFT JOIN profiles pr ON p.author_id = pr.id
      LEFT JOIN public.departments d ON d.id = pr.department_id
      ${repostWhereClause}
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT $${repostParams.length};
    `;

    const repostQueryParams = viewerId ? [...repostParams, viewerId] : repostParams;
    const repostsResult = await db.query(repostsSql, repostQueryParams);

    reposts = repostsResult.rows.map(row => ({
      kind: 'repost',
      repost: {
        id: row.repost_id,
        reposter_id: row.reposter_id,
        original_post_id: row.original_post_id,
        caption: row.repost_caption,
        visibility: row.repost_visibility,
        created_at: row.repost_created_at,
        deleted_at: row.repost_deleted_at,
      },
      // Original post data (same structure as posts)
      id: row.id,
      author_id: row.author_id,
      content: row.content,
      type: row.type,
      title: row.title,
      technologies: row.technologies,
      github_url: row.github_url,
      image_url: row.image_url,
      image_urls: row.image_urls || (row.image_url ? [row.image_url] : []),
      preview_metadata: row.preview_metadata,
      visibility: row.visibility,
      allow_reposts: row.allow_reposts,
      author_department_id: row.author_department_id,
      author_course_id: row.author_course_id,
      repost_count: row.repost_count,
      deleted_at: row.deleted_at,
      edited_at: row.edited_at,
      moderation_status: row.moderation_status,
      moderation_reason: row.moderation_reason,
      created_at: row.created_at,
      likes: row.likes,
      comments: row.comments,
      author: row.author,
      is_liked: row.is_liked,
    }));
  }

  const posts = postsResult.rows.map(row => ({
    kind: 'post',
    ...row,
  }));

  // ---- 3. Merge and sort by created_at ---------------------------------------
  const allItems = [...posts, ...reposts].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  return { posts: allItems };
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
    image_urls,
    preview_metadata = null,
    moderation_status = 'approved',
    moderation_reason = null,
    visibility = 'public',
    audience = null,
    allow_reposts = true,
  } = postData;

  const effectiveImageUrls = Array.isArray(image_urls)
    ? image_urls
    : (image_url ? [image_url] : []);
  const effectiveImageUrl = image_url || (effectiveImageUrls.length > 0 ? effectiveImageUrls[0] : null);

  return db.withTransaction(async (client) => {
    // Snapshot author's department and course at post creation time
    const profileResult = await client.query(
      `SELECT department_id, course_id FROM profiles WHERE id = $1`,
      [author_id]
    );
    const author_department_id = profileResult.rows[0]?.department_id || null;
    const author_course_id = profileResult.rows[0]?.course_id || null;

    const sql = `
      INSERT INTO posts (author_id, content, type, title, technologies, github_url, image_url, image_urls, preview_metadata, moderation_status, moderation_reason, visibility, allow_reposts, author_department_id, author_course_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *;
    `;
    const values = [
      author_id,
      content,
      type || 'text',
      title || null,
      technologies || null,
      github_url || null,
      effectiveImageUrl,
      effectiveImageUrls,
      preview_metadata ? JSON.stringify(preview_metadata) : null,
      moderation_status,
      moderation_reason,
      visibility,
      allow_reposts,
      author_department_id,
      author_course_id,
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
  "image_urls",
  "preview_metadata",
  "visibility",
  "allow_reposts",
];

// Partial update. Ownership is enforced in SQL, and the audience list is only
// touched when the caller actually sent `visibility`/`audience` - otherwise an
// unrelated edit (a title change) would silently wipe the custom list.
const updatePost = async (id, authorId, postData) => {
  const updatePayload = { ...postData };
  if (updatePayload.image_urls !== undefined && updatePayload.image_url === undefined) {
    updatePayload.image_url = Array.isArray(updatePayload.image_urls) && updatePayload.image_urls.length > 0
      ? updatePayload.image_urls[0]
      : null;
  } else if (updatePayload.image_url !== undefined && updatePayload.image_urls === undefined) {
    updatePayload.image_urls = updatePayload.image_url ? [updatePayload.image_url] : [];
  }

  const fields = POST_UPDATABLE_COLUMNS.filter(
    (column) => updatePayload[column] !== undefined
  );
  const touchesAudience =
    updatePayload.audience !== undefined || updatePayload.visibility !== undefined;

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
      // Add edited_at to the update
      const setClause = fields.map((column, i) => `${column} = $${i + 1}`).join(", ");
      const values = fields.map((column) => updatePayload[column]);
      values.push(id, authorId);

      const result = await client.query(
        `
          UPDATE posts
          SET ${setClause}, edited_at = now()
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


const softDeletePost = async (id, authorId) => {
  const sql = `UPDATE posts SET deleted_at = now() WHERE id = $1 AND author_id = $2 RETURNING *;`;
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
      p.image_urls,
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
  visiblePostsFor,
  createPost,
  updatePost,
  softDeletePost,
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
