const db = require("../db");
const { DEFAULT_LIMIT } = require("./pagination");
const { escapeLike } = require("../utils/queryFilters");
const mentionsService = require("../services/mentions");
const notificationService = require("../services/notificationService");

const POST_ATTACHMENTS_SQL = `
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', a.id,
      'storage_key', a.storage_key,
      'file_name', a.file_name,
      'mime_type', a.mime_type,
      'size_bytes', a.size_bytes,
      'sort_order', a.sort_order
    ) ORDER BY a.sort_order)
    FROM public.post_attachments a WHERE a.post_id = p.id
  ), '[]'::json) AS attachments
`;

const POST_MENTIONS_SQL = `
  COALESCE((
    SELECT json_agg(json_build_object(
      'user_id', m.mentioned_user_id,
      'username', pr_m.username,
      'full_name', pr_m.full_name
    ) ORDER BY pr_m.full_name)
    FROM public.post_mentions m
    JOIN public.profiles pr_m ON pr_m.id = m.mentioned_user_id
    WHERE m.post_id = p.id AND m.comment_id IS NULL
  ), '[]'::json) AS mentions
`;

function withDerivedImages(row) {
  if (!row) return row;
  const attachments = Array.isArray(row.attachments) ? row.attachments : [];
  const imageAttachments = attachments.filter(
    (a) => a.mime_type && a.mime_type.startsWith("image/")
  );
  const derivedImageUrls = imageAttachments.map((a) => a.storage_key);
  const imageUrls = derivedImageUrls;
  const imageUrl = imageUrls[0] || null;

  const derivedType =
    row.repository_type ||
    (row.kind === "repository"
      ? "project"
      : row.kind === "announcement"
      ? "announcement"
      : imageUrls.length > 0
      ? "image"
      : row.preview_metadata
      ? "website"
      : "text");

  return {
    ...row,
    type: row.type || derivedType,
    attachments,
    image_urls: imageUrls,
    image_url: imageUrl,
    mentions: Array.isArray(row.mentions) ? row.mentions : [],
  };
}

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
  kind = null,
  repository_type = null,
  repository_category = null,
  categories = null,
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

  if (kind && ['discussion', 'repository', 'announcement'].includes(kind)) {
    params.push(kind);
    conditions.push(`p.kind = $${params.length}`);
  }

  if (repository_type && ['project', 'capstone', 'thesis'].includes(repository_type)) {
    params.push(repository_type);
    conditions.push(`p.repository_type = $${params.length}`);
  }

  if (repository_category) {
    params.push(repository_category);
    conditions.push(`p.repository_category = $${params.length}`);
  } else if (Array.isArray(categories) && categories.length > 0) {
    params.push(categories);
    conditions.push(`p.repository_category = ANY($${params.length}::text[])`);
  }

  if (cursor) {
    const parts = String(cursor).split("|");
    let isPinned = false;
    let createdAt = null;
    let id = null;

    if (parts.length >= 3) {
      isPinned = parts[0] === "true" || parts[0] === "1";
      createdAt = parts[1];
      id = parts[2];
    } else if (parts.length === 2) {
      isPinned = false;
      createdAt = parts[0];
      id = parts[1];
    }

    if (createdAt && id) {
      params.push(isPinned, createdAt, id);
      const pinnedParam = `$${params.length - 2}::boolean`;
      const createdParam = `$${params.length - 1}::timestamptz`;
      const idParam = `$${params.length}::uuid`;
      conditions.push(`(
        (COALESCE(p.pinned, false) = false AND ${pinnedParam} = true)
        OR (
          COALESCE(p.pinned, false) = ${pinnedParam}
          AND (
            p.created_at < ${createdParam}
            OR (p.created_at = ${createdParam} AND p.id < ${idParam})
          )
        )
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
      p.kind,
      p.repository_type,
      p.repository_category,
      p.live_url,
      p.title,
      p.technologies,
      p.github_url,
      p.pinned,
      ${POST_ATTACHMENTS_SQL},
      ${POST_MENTIONS_SQL},
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
    ORDER BY p.pinned DESC, p.created_at DESC, p.id DESC
    LIMIT $${params.length};
  `;
  
  const queryParams = userId ? [...params, userId] : params;
  const result = await db.query(sql, queryParams);
  return result.rows.map(withDerivedImages);
};

// `viewerId` gates which posts exist at all; `includeHidden` is the moderation
// escape hatch that reads the base table instead.
const getPostById = async (id, options = {}) => {
  const opts = typeof options === "string" ? { userId: options } : (options || {});
  const { includeHidden = false, userId = null } = opts;
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
      p.kind,
      p.repository_type,
      p.repository_category,
      p.live_url,
      p.title,
      p.technologies,
      p.github_url,
      p.pinned,
      ${POST_ATTACHMENTS_SQL},
      ${POST_MENTIONS_SQL},
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
  return withDerivedImages(result.rows[0]);
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
  'text', 'image', 'website', 'project', 'capstone', 'dissertation', 'thesis', 'discussion', 'announcement'
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
      p.kind,
      p.repository_type,
      p.repository_category,
      p.live_url,
      p.title,
      p.technologies,
      p.github_url,
      p.pinned,
      ${POST_ATTACHMENTS_SQL},
      ${POST_MENTIONS_SQL},
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
      p.kind,
      p.repository_type,
      p.repository_category,
      p.live_url,
      p.title,
      p.technologies,
      p.github_url,
      p.pinned,
      ${POST_ATTACHMENTS_SQL},
      ${POST_MENTIONS_SQL},
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
  kind = null,
  repository_type = null,
  repository_category = null,
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

  if (type) {
    if (['project', 'capstone', 'thesis', 'dissertation'].includes(type)) {
      const repType = type === 'dissertation' ? 'thesis' : type;
      params.push(repType);
      conditions.push(`p.kind = 'repository' AND p.repository_type = $${params.length}`);
    } else if (type === 'discussion') {
      conditions.push(`p.kind = 'discussion'`);
    } else if (type === 'announcement') {
      conditions.push(`p.kind = 'announcement'`);
    } else if (type === 'website') {
      conditions.push(`p.preview_metadata IS NOT NULL`);
    } else if (type === 'image') {
      conditions.push(`EXISTS (
        SELECT 1 FROM post_attachments pa 
        WHERE pa.post_id = p.id AND pa.mime_type LIKE 'image/%'
      )`);
    } else if (type === 'text') {
      conditions.push(`p.kind = 'discussion' AND p.preview_metadata IS NULL AND NOT EXISTS (
        SELECT 1 FROM post_attachments pa WHERE pa.post_id = p.id
      )`);
    }
  }

  if (kind && ['discussion', 'repository', 'announcement'].includes(kind)) {
    params.push(kind);
    conditions.push(`p.kind = $${params.length}`);
  }

  if (repository_type && ['project', 'capstone', 'thesis'].includes(repository_type)) {
    params.push(repository_type);
    conditions.push(`p.repository_type = $${params.length}`);
  }

  if (repository_category) {
    params.push(repository_category);
    conditions.push(`p.repository_category = $${params.length}`);
  }

    if (visibility && ['public', 'department', 'friends', 'private', 'custom'].includes(visibility)) {
      params.push(visibility);
      conditions.push(`p.visibility = $${params.length}`);
    }

    if (postId) {
      params.push(postId);
      conditions.push(`p.id = $${params.length}::uuid`);
    }

    if (cursor) {
    const parts = String(cursor).split("|");
    let isPinned = false;
    let createdAt = null;
    let id = null;

    if (parts.length >= 3) {
      isPinned = parts[0] === "true" || parts[0] === "1";
      createdAt = parts[1];
      id = parts[2];
    } else if (parts.length === 2) {
      isPinned = false;
      createdAt = parts[0];
      id = parts[1];
    }

    if (createdAt && id) {
      params.push(isPinned, createdAt, id);
      const pinnedParam = `$${params.length - 2}::boolean`;
      const createdParam = `$${params.length - 1}::timestamptz`;
      const idParam = `$${params.length}::uuid`;
      conditions.push(`(
        (COALESCE(p.pinned, false) = false AND ${pinnedParam} = true)
        OR (
          COALESCE(p.pinned, false) = ${pinnedParam}
          AND (
            p.created_at < ${createdParam}
            OR (p.created_at = ${createdParam} AND p.id < ${idParam})
          )
        )
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
    ORDER BY p.pinned DESC, p.created_at DESC, p.id DESC
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

    reposts = repostsResult.rows.map(row => {
      const derived = withDerivedImages({
        ...row,
        kind: row.kind || 'discussion',
      });
      return {
        ...derived,
        kind: 'repost',
        post_kind: derived.kind || 'discussion',
        repost: {
          id: row.repost_id,
          reposter_id: row.reposter_id,
          original_post_id: row.original_post_id,
          caption: row.repost_caption,
          visibility: row.repost_visibility,
          created_at: row.repost_created_at,
          deleted_at: row.repost_deleted_at,
        },
      };
    });
  }

  const posts = postsResult.rows.map(row => withDerivedImages({
    ...row,
    kind: row.kind || 'discussion',
  }));

  // ---- 3. Merge and sort by created_at ---------------------------------------
  const allItems = [...posts, ...reposts].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  // The cursor is built here, beside the ORDER BY it mirrors, so clients never
  // have to know the keyset format. Ordering is `pinned DESC, created_at DESC,
  // id DESC`, so the marker carries all three columns.
  const lastRow = postsResult.rows[postsResult.rows.length - 1];
  const next_cursor =
    postsResult.rows.length === limit && lastRow
      ? `${lastRow.pinned ? "true" : "false"}|${new Date(lastRow.created_at).toISOString()}|${lastRow.id}`
      : null;

  return { posts: allItems, next_cursor };
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
    kind = 'discussion',
    repository_type = null,
    repository_category = null,
    live_url = null,
    title,
    technologies,
    github_url,
    image_url,
    image_urls,
    attachments,
    preview_metadata = null,
    moderation_status = 'approved',
    moderation_reason = null,
    visibility = 'public',
    audience = null,
    allow_reposts = true,
  } = postData;

  const imageAttachments = Array.isArray(attachments)
    ? attachments.filter((a) => a.mime_type && a.mime_type.startsWith("image/"))
    : [];
  const derivedImageUrls = imageAttachments.map((a) => a.storage_key);
  const effectiveImageUrls = derivedImageUrls.length > 0
    ? derivedImageUrls
    : (Array.isArray(image_urls) ? image_urls : (image_url ? [image_url] : []));
  const effectiveImageUrl = effectiveImageUrls[0] || null;

  return db.withTransaction(async (client) => {
    // Snapshot author's department and course at post creation time
    const profileResult = await client.query(
      `SELECT username, department_id, course_id FROM profiles WHERE id = $1`,
      [author_id]
    );
    const author_username = profileResult.rows[0]?.username || null;
    const author_department_id = profileResult.rows[0]?.department_id || null;
    const author_course_id = profileResult.rows[0]?.course_id || null;

    const sql = `
      INSERT INTO posts (author_id, content, kind, repository_type, repository_category, live_url, title, technologies, github_url, preview_metadata, moderation_status, moderation_reason, visibility, allow_reposts, author_department_id, author_course_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *;
    `;
    const values = [
      author_id,
      content,
      kind,
      repository_type,
      repository_category,
      live_url,
      title || null,
      technologies || null,
      github_url || null,
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

    // Insert attachments transactionally
    let persistedAttachments = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i];
        const attRes = await client.query(
          `INSERT INTO public.post_attachments (post_id, storage_key, file_name, mime_type, size_bytes, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (post_id, storage_key) DO UPDATE
           SET file_name = EXCLUDED.file_name,
               mime_type = EXCLUDED.mime_type,
               size_bytes = EXCLUDED.size_bytes,
               sort_order = EXCLUDED.sort_order
           RETURNING *;`,
          [post.id, att.storage_key, att.file_name, att.mime_type, att.size_bytes ?? null, i]
        );
        persistedAttachments.push(attRes.rows[0]);
      }
    } else if (effectiveImageUrls.length > 0) {
      for (let i = 0; i < effectiveImageUrls.length; i++) {
        const key = effectiveImageUrls[i];
        const mime = key.endsWith(".png") ? "image/png" : (key.endsWith(".webp") ? "image/webp" : "image/jpeg");
        const attRes = await client.query(
          `INSERT INTO public.post_attachments (post_id, storage_key, file_name, mime_type, size_bytes, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (post_id, storage_key) DO NOTHING
           RETURNING *;`,
          [post.id, key, key.split("/").pop() || "image.jpg", mime, null, i]
        );
        if (attRes.rows[0]) persistedAttachments.push(attRes.rows[0]);
      }
    }

    // A non-custom post stores no audience; a custom one must.
    if (post.visibility === 'custom') {
      await setPostAudience(client, post.id, audience);
    }

    let persistedMentions = [];
    if (Array.isArray(postData.mentions) && postData.mentions.length > 0) {
      await mentionsService.replacePostMentions(post.id, null, postData.mentions, client);
      const mRes = await client.query(
        `SELECT m.mentioned_user_id AS user_id, pr.username, pr.full_name
         FROM public.post_mentions m
         JOIN public.profiles pr ON pr.id = m.mentioned_user_id
         WHERE m.post_id = $1 AND m.comment_id IS NULL
         ORDER BY pr.full_name`,
        [post.id]
      );
      persistedMentions = mRes.rows;

      await notificationService.notifyMentionedUsers({
        mentionedUserIds: postData.mentions,
        actorId: author_id,
        actorUsername: author_username,
        targetId: post.id,
        client,
      });
    }

    return withDerivedImages({ ...post, attachments: persistedAttachments, mentions: persistedMentions });
  });
};

const POST_UPDATABLE_COLUMNS = [
  "content",
  "kind",
  "repository_type",
  "repository_category",
  "live_url",
  "title",
  "technologies",
  "github_url",
  "preview_metadata",
  "visibility",
  "allow_reposts",
];

// Partial update. Ownership is enforced in SQL, and the audience list is only
// touched when the caller actually sent `visibility`/`audience` - otherwise an
// unrelated edit (a title change) would silently wipe the custom list.
const updatePost = async (id, authorId, postData) => {
  const updatePayload = { ...postData };
  const touchesAudience =
    updatePayload.audience !== undefined || updatePayload.visibility !== undefined;

  let candidateAttachments = updatePayload.attachments;
  if (candidateAttachments === undefined && (updatePayload.image_urls !== undefined || updatePayload.image_url !== undefined)) {
    const urls = Array.isArray(updatePayload.image_urls)
      ? updatePayload.image_urls
      : (updatePayload.image_url ? [updatePayload.image_url] : []);
    candidateAttachments = urls.map((url, i) => ({
      storage_key: url,
      file_name: url.split("/").pop() || "image.jpg",
      mime_type: url.endsWith(".png") ? "image/png" : (url.endsWith(".webp") ? "image/webp" : "image/jpeg"),
      size_bytes: null,
      sort_order: i,
    }));
  }

  const touchesAttachments = candidateAttachments !== undefined;

  const fields = POST_UPDATABLE_COLUMNS.filter(
    (column) => updatePayload[column] !== undefined
  );

  if (fields.length === 0 && !touchesAudience && !touchesAttachments) {
    const current = await db.query(
      `SELECT p.*, ${POST_ATTACHMENTS_SQL}, ${POST_MENTIONS_SQL} FROM posts p WHERE p.id = $1 AND p.author_id = $2;`,
      [id, authorId]
    );
    return withDerivedImages(current.rows[0]);
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

    let persistedAttachments = [];
    if (touchesAttachments) {
      await client.query(
        `DELETE FROM public.post_attachments WHERE post_id = $1`,
        [id]
      );
      if (Array.isArray(candidateAttachments) && candidateAttachments.length > 0) {
        for (let i = 0; i < candidateAttachments.length; i++) {
          const att = candidateAttachments[i];
          const attRes = await client.query(
            `INSERT INTO public.post_attachments (post_id, storage_key, file_name, mime_type, size_bytes, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (post_id, storage_key) DO UPDATE
             SET file_name = EXCLUDED.file_name,
                 mime_type = EXCLUDED.mime_type,
                 size_bytes = EXCLUDED.size_bytes,
                 sort_order = EXCLUDED.sort_order
             RETURNING *;`,
            [id, att.storage_key, att.file_name, att.mime_type, att.size_bytes ?? null, i]
          );
          persistedAttachments.push(attRes.rows[0]);
        }
      }
    } else {
      const existingAtt = await client.query(
        `SELECT id, storage_key, file_name, mime_type, size_bytes, sort_order
         FROM public.post_attachments WHERE post_id = $1 ORDER BY sort_order`,
        [id]
      );
      persistedAttachments = existingAtt.rows;
    }

    if (post.visibility === 'custom') {
      if (postData.audience !== undefined) {
        await setPostAudience(client, post.id, postData.audience);
      }
    } else {
      await setPostAudience(client, post.id, []);
    }

    let persistedMentions = [];
    if (postData.mentions !== undefined) {
      await mentionsService.replacePostMentions(id, null, postData.mentions, client);
      const mRes = await client.query(
        `SELECT m.mentioned_user_id AS user_id, pr.username, pr.full_name
         FROM public.post_mentions m
         JOIN public.profiles pr ON pr.id = m.mentioned_user_id
         WHERE m.post_id = $1 AND m.comment_id IS NULL
         ORDER BY pr.full_name`,
        [id]
      );
      persistedMentions = mRes.rows;
    } else {
      const mRes = await client.query(
        `SELECT m.mentioned_user_id AS user_id, pr.username, pr.full_name
         FROM public.post_mentions m
         JOIN public.profiles pr ON pr.id = m.mentioned_user_id
         WHERE m.post_id = $1 AND m.comment_id IS NULL
         ORDER BY pr.full_name`,
        [id]
      );
      persistedMentions = mRes.rows;
    }

    return withDerivedImages({ ...post, attachments: persistedAttachments, mentions: persistedMentions });
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
      COALESCE((
        SELECT json_agg(json_build_object(
          'user_id', m.mentioned_user_id,
          'username', pr_m.username,
          'full_name', pr_m.full_name
        ) ORDER BY pr_m.full_name)
        FROM public.post_mentions m
        JOIN public.profiles pr_m ON pr_m.id = m.mentioned_user_id
        WHERE m.comment_id = c.id
      ), '[]'::json) AS mentions,
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
      COALESCE((
        SELECT json_agg(json_build_object(
          'user_id', m.mentioned_user_id,
          'username', pr_m.username,
          'full_name', pr_m.full_name
        ) ORDER BY pr_m.full_name)
        FROM public.post_mentions m
        JOIN public.profiles pr_m ON pr_m.id = m.mentioned_user_id
        WHERE m.comment_id = c.id
      ), '[]'::json) AS mentions,
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

const addComment = async (postId, userId, content, { moderation_status = 'approved', moderation_reason = null, mention_ids = [] } = {}) => {
  const sql = `
    INSERT INTO comments (post_id, user_id, content, moderation_status, moderation_reason)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const result = await db.query(sql, [postId, userId, content, moderation_status, moderation_reason]);
  const comment = result.rows[0];

  let persistedMentions = [];
  if (Array.isArray(mention_ids) && mention_ids.length > 0) {
    await mentionsService.replacePostMentions(postId, comment.id, mention_ids);
    const mRes = await db.query(
      `SELECT m.mentioned_user_id AS user_id, pr.username, pr.full_name
       FROM public.post_mentions m
       JOIN public.profiles pr ON pr.id = m.mentioned_user_id
       WHERE m.comment_id = $1
       ORDER BY pr.full_name`,
      [comment.id]
    );
    persistedMentions = mRes.rows;

    const uRes = await db.query(`SELECT username FROM profiles WHERE id = $1`, [userId]);
    await notificationService.notifyMentionedUsers({
      mentionedUserIds: mention_ids,
      actorId: userId,
      actorUsername: uRes.rows[0]?.username || null,
      targetId: postId,
    });
  }

  return { ...comment, mentions: persistedMentions };
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
      p.kind,
      p.repository_type,
      p.repository_category,
      p.live_url,
      p.title,
      p.technologies,
      p.github_url,
      p.pinned,
      ${POST_ATTACHMENTS_SQL},
      ${POST_MENTIONS_SQL},
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
  return result.rows.map(withDerivedImages);
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

const updateCommentByAuthor = async (id, postId, userId, content, { mention_ids = null } = {}) => {
  const sql = `
    UPDATE comments
    SET content = $1, moderation_status = 'approved', moderation_reason = NULL
    WHERE id = $2 AND post_id = $3 AND user_id = $4 AND moderation_status != 'hidden'
    RETURNING *;
  `;
  const result = await db.query(sql, [content, id, postId, userId]);
  const comment = result.rows[0];
  if (comment && Array.isArray(mention_ids)) {
    await mentionsService.replacePostMentions(postId, id, mention_ids);
  }
  return comment;
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
  withDerivedImages,
  POST_ATTACHMENTS_SQL,
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
