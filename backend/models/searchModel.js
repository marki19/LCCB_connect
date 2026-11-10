const db = require("../db");
const { escapeLike } = require("../utils/queryFilters");
const { DEFAULT_LIMIT } = require("./pagination");

/**
 * Multi-Entity Search Model
 * Uses PostgreSQL Full-Text Search (tsvector + tsquery) combined with
 * Trigram fuzzy similarity (pg_trgm) for typo tolerance and relevance ranking.
 *
 * All posts and theses reads go through visible_posts() and visible_theses()
 * so content visibility rules are strictly respected.
 */

/**
 * Search students, faculty, and alumni.
 */
const searchPeople = async (query, viewerId = null, { limit = DEFAULT_LIMIT, offset = 0 } = {}) => {
  if (!query || !query.trim()) return [];

  const cleanQuery = query.trim();
  const likeQuery = `%${escapeLike(cleanQuery)}%`;

  const params = [cleanQuery, likeQuery, limit, offset];
  let blockFilter = "";

  if (viewerId) {
    params.push(viewerId);
    blockFilter = `
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = $5 AND b.blocked_id = pr.id)
           OR (b.blocker_id = pr.id AND b.blocked_id = $5)
      )
    `;
  }

  const sql = `
    SELECT 
      pr.id,
      pr.username,
      pr.full_name,
      pr.avatar_url,
      pr.bio,
      pr.course,
      pr.year_level,
      pr.role,
      pr.verification_status,
      pr.department_id,
      d.name AS department_name,
      GREATEST(
        similarity(COALESCE(pr.full_name, ''), $1),
        similarity(COALESCE(pr.username, ''), $1)
      ) AS sim_score,
      ts_rank_cd(
        to_tsvector('english', COALESCE(pr.full_name, '') || ' ' || COALESCE(pr.username, '') || ' ' || COALESCE(pr.bio, '') || ' ' || COALESCE(d.name, '')),
        plainto_tsquery('english', $1)
      ) AS fts_rank
    FROM public.profiles pr
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE pr.role != 'guest'
      ${blockFilter}
      AND (
        pr.full_name ILIKE $2 ESCAPE '!'
        OR pr.username ILIKE $2 ESCAPE '!'
        OR d.name ILIKE $2 ESCAPE '!'
        OR similarity(COALESCE(pr.full_name, ''), $1) > 0.15
        OR similarity(COALESCE(pr.username, ''), $1) > 0.15
        OR to_tsvector('english', COALESCE(pr.full_name, '') || ' ' || COALESCE(pr.username, '') || ' ' || COALESCE(pr.bio, '') || ' ' || COALESCE(d.name, '')) @@ plainto_tsquery('english', $1)
      )
    ORDER BY (
      GREATEST(similarity(COALESCE(pr.full_name, ''), $1), similarity(COALESCE(pr.username, ''), $1)) * 3.0 +
      ts_rank_cd(to_tsvector('english', COALESCE(pr.full_name, '') || ' ' || COALESCE(pr.username, '') || ' ' || COALESCE(pr.bio, '') || ' ' || COALESCE(d.name, '')), plainto_tsquery('english', $1)) * 2.0
    ) DESC, pr.verification_status DESC, pr.created_at DESC
    LIMIT $3 OFFSET $4
  `;

  const result = await db.query(sql, params);
  return result.rows;
};

/**
 * Search feed posts matching query, strictly bounded by visible_posts().
 */
const searchPosts = async (query, viewerId = null, { limit = DEFAULT_LIMIT, offset = 0 } = {}) => {
  if (!query || !query.trim()) return [];

  const cleanQuery = query.trim();
  const likeQuery = `%${escapeLike(cleanQuery)}%`;

  const params = [viewerId, cleanQuery, likeQuery, limit, offset];

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
      p.allow_reposts,
      COALESCE((SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id), 0) AS likes,
      COALESCE((SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id), 0) AS like_count,
      COALESCE((SELECT COUNT(*)::int FROM reposts r WHERE r.original_post_id = p.id), 0) AS repost_count,
      COALESCE((SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id AND c.moderation_status != 'hidden'), 0) AS comments,
      COALESCE((SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id AND c.moderation_status != 'hidden'), 0) AS comment_count,
      p.created_at,
      p.updated_at,
      (SELECT EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1)) AS is_liked,
      (SELECT EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $1)) AS is_saved,
      json_build_object(
        'id', pr.id,
        'full_name', pr.full_name,
        'username', pr.username,
        'avatar_url', pr.avatar_url,
        'department_name', d.name,
        'role', pr.role,
        'verification_status', pr.verification_status
      ) AS author,
      similarity(COALESCE(p.title, ''), $2) AS sim_title,
      ts_rank_cd(
        to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, '')),
        plainto_tsquery('english', $2)
      ) AS fts_rank
    FROM visible_posts($1::text) p
    LEFT JOIN public.profiles pr ON pr.id = p.author_id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE p.deleted_at IS NULL
      AND (
        p.title ILIKE $3 ESCAPE '!'
        OR p.content ILIKE $3 ESCAPE '!'
        OR to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, '')) @@ plainto_tsquery('english', $2)
        OR similarity(COALESCE(p.title, ''), $2) > 0.15
        OR similarity(COALESCE(p.content, ''), $2) > 0.15
      )
    ORDER BY (
      ts_rank_cd(to_tsvector('english', COALESCE(p.title, '') || ' ' || COALESCE(p.content, '')), plainto_tsquery('english', $2)) * 2.5 +
      similarity(COALESCE(p.title, ''), $2) * 1.5 +
      similarity(COALESCE(p.content, ''), $2) * 1.0
    ) DESC, p.created_at DESC
    LIMIT $4 OFFSET $5
  `;

  const result = await db.query(sql, params);
  return result.rows;
};

/**
 * Search academic theses, capstones, and dissertations, bounded by visible_theses().
 */
const searchTheses = async (query, viewerId = null, { limit = DEFAULT_LIMIT, offset = 0 } = {}) => {
  if (!query || !query.trim()) return [];

  const cleanQuery = query.trim();
  const likeQuery = `%${escapeLike(cleanQuery)}%`;

  const params = [viewerId, cleanQuery, likeQuery, limit, offset];

  const sql = `
    SELECT 
      t.id,
      t.title,
      t.abstract,
      t.category,
      t.pdf_url,
      t.visibility,
      t.created_at,
      t.updated_at,
      json_build_object(
        'id', pr.id,
        'full_name', pr.full_name,
        'username', pr.username,
        'avatar_url', pr.avatar_url,
        'department_name', d.name
      ) AS uploader,
      similarity(t.title, $2) AS sim_title,
      ts_rank_cd(
        to_tsvector('english', COALESCE(t.title, '') || ' ' || COALESCE(t.abstract, '')),
        plainto_tsquery('english', $2)
      ) AS fts_rank
    FROM visible_theses($1::text) t
    LEFT JOIN public.profiles pr ON pr.id = t.uploader_id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE (
      t.title ILIKE $3 ESCAPE '!'
      OR t.abstract ILIKE $3 ESCAPE '!'
      OR to_tsvector('english', COALESCE(t.title, '') || ' ' || COALESCE(t.abstract, '')) @@ plainto_tsquery('english', $2)
      OR similarity(t.title, $2) > 0.15
    )
    ORDER BY (
      ts_rank_cd(to_tsvector('english', COALESCE(t.title, '') || ' ' || COALESCE(t.abstract, '')), plainto_tsquery('english', $2)) * 2.5 +
      similarity(t.title, $2) * 1.5
    ) DESC, t.created_at DESC
    LIMIT $4 OFFSET $5
  `;

  const result = await db.query(sql, params);
  return result.rows;
};

/**
 * Universal multi-entity search.
 * Concurrently queries People, Posts, and Theses.
 */
const searchAll = async (query, viewerId = null, { limit = 10 } = {}) => {
  if (!query || !query.trim()) {
    return {
      query: "",
      people: [],
      posts: [],
      theses: [],
      counts: { people: 0, posts: 0, theses: 0, total: 0 },
    };
  }

  const [people, posts, theses] = await Promise.all([
    searchPeople(query, viewerId, { limit, offset: 0 }),
    searchPosts(query, viewerId, { limit, offset: 0 }),
    searchTheses(query, viewerId, { limit, offset: 0 }),
  ]);

  return {
    query,
    people,
    posts,
    theses,
    counts: {
      people: people.length,
      posts: posts.length,
      theses: theses.length,
      total: people.length + posts.length + theses.length,
    },
  };
};

/**
 * Fast typeahead suggestions for topbar search dropdown.
 */
const searchSuggestions = async (query, viewerId = null, { limit = 6 } = {}) => {
  if (!query || !query.trim()) return [];

  const [people, posts, theses] = await Promise.all([
    searchPeople(query, viewerId, { limit: 3, offset: 0 }),
    searchPosts(query, viewerId, { limit: 2, offset: 0 }),
    searchTheses(query, viewerId, { limit: 2, offset: 0 }),
  ]);

  const suggestions = [];

  people.forEach((p) => {
    suggestions.push({
      type: "person",
      id: p.id,
      title: p.full_name || p.username,
      subtitle: `${p.department_name || "Campus Peer"} · ${p.role || "student"}`,
      avatarUrl: p.avatar_url,
      href: `/profile/${p.id}`,
    });
  });

  posts.forEach((po) => {
    suggestions.push({
      type: "post",
      id: po.id,
      title: po.title || (po.content ? po.content.slice(0, 50) + "…" : "Post"),
      subtitle: `By ${po.author?.full_name || "Unknown"}`,
      href: `/post/${po.id}`,
    });
  });

  theses.forEach((t) => {
    suggestions.push({
      type: "thesis",
      id: t.id,
      title: t.title,
      subtitle: `${t.category || "Research Paper"} · ${t.uploader?.department_name || ""}`,
      href: `/(tabs)/search?id=${t.id}`,
    });
  });

  return suggestions.slice(0, limit);
};

module.exports = {
  searchPeople,
  searchPosts,
  searchTheses,
  searchAll,
  searchSuggestions,
};

