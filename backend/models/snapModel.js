const db = require("../db");

/**
 * Creates a new snap (24-hour story).
 */
const createSnap = async ({
  authorId,
  mediaKey,
  mediaType,
  caption = null,
  visibility = "public",
  authorDepartmentId = null,
}) => {
  const sql = `
    INSERT INTO public.snaps (
      author_id,
      media_key,
      media_type,
      caption,
      visibility,
      author_department_id,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '24 hours')
    RETURNING *;
  `;
  const result = await db.query(sql, [
    authorId,
    mediaKey,
    mediaType,
    caption,
    visibility,
    authorDepartmentId,
  ]);
  return result.rows[0];
};

/**
 * Retrieves the grouped rail of active snaps visible to the viewer.
 */
const getRailSnaps = async (viewerId) => {
  const sql = `
    WITH vis_snaps AS (
      SELECT
        s.id,
        s.author_id,
        s.media_key,
        s.media_type,
        s.caption,
        s.visibility,
        s.created_at,
        s.expires_at,
        EXISTS (
          SELECT 1 FROM public.snap_views v
          WHERE v.snap_id = s.id AND v.viewer_id = $1
        ) AS is_viewed,
        (
          SELECT COUNT(*)::int FROM public.snap_reactions r
          WHERE r.snap_id = s.id
        ) AS reactions_count,
        (
          SELECT COUNT(*)::int FROM public.snap_views v
          WHERE v.snap_id = s.id
        ) AS views_count
      FROM public.visible_snaps($1) s
    )
    SELECT
      pr.id AS author_id,
      pr.username,
      pr.full_name,
      pr.avatar_url,
      json_agg(
        json_build_object(
          'id', vs.id,
          'author_id', vs.author_id,
          'media_key', vs.media_key,
          'media_type', vs.media_type,
          'caption', vs.caption,
          'visibility', vs.visibility,
          'created_at', vs.created_at,
          'expires_at', vs.expires_at,
          'is_viewed', vs.is_viewed,
          'reactions_count', vs.reactions_count,
          'views_count', vs.views_count
        ) ORDER BY vs.created_at ASC
      ) AS snaps,
      bool_or(NOT vs.is_viewed) AS has_unviewed,
      MAX(vs.created_at) AS latest_created_at
    FROM vis_snaps vs
    JOIN public.profiles pr ON pr.id = vs.author_id
    GROUP BY pr.id, pr.username, pr.full_name, pr.avatar_url
    ORDER BY
      CASE WHEN pr.id = $1 THEN 0 ELSE 1 END,
      has_unviewed DESC,
      latest_created_at DESC;
  `;
  const result = await db.query(sql, [viewerId]);
  return result.rows;
};

/**
 * Retrieves active snaps for a specific user visible to viewer.
 */
const getUserSnaps = async (userId, viewerId) => {
  const sql = `
    SELECT
      s.id,
      s.author_id,
      s.media_key,
      s.media_type,
      s.caption,
      s.visibility,
      s.created_at,
      s.expires_at,
      pr.username,
      pr.full_name,
      pr.avatar_url,
      EXISTS (
        SELECT 1 FROM public.snap_views v
        WHERE v.snap_id = s.id AND v.viewer_id = $2
      ) AS is_viewed,
      (
        SELECT reaction FROM public.snap_reactions r
        WHERE r.snap_id = s.id AND r.user_id = $2
      ) AS viewer_reaction,
      (
        SELECT COUNT(*)::int FROM public.snap_reactions r
        WHERE r.snap_id = s.id
      ) AS reactions_count,
      (
        SELECT COUNT(*)::int FROM public.snap_views v
        WHERE v.snap_id = s.id
      ) AS views_count
    FROM public.visible_snaps($2) s
    JOIN public.profiles pr ON pr.id = s.author_id
    WHERE s.author_id = $1
    ORDER BY s.created_at ASC;
  `;
  const result = await db.query(sql, [userId, viewerId]);
  return result.rows;
};

/**
 * Retrieves a single snap by ID if visible to viewer.
 */
const getSnapById = async (snapId, viewerId) => {
  const sql = `
    SELECT
      s.*,
      pr.username,
      pr.full_name,
      pr.avatar_url,
      EXISTS (
        SELECT 1 FROM public.snap_views v
        WHERE v.snap_id = s.id AND v.viewer_id = $2
      ) AS is_viewed,
      (
        SELECT reaction FROM public.snap_reactions r
        WHERE r.snap_id = s.id AND r.user_id = $2
      ) AS viewer_reaction,
      (
        SELECT COUNT(*)::int FROM public.snap_reactions r
        WHERE r.snap_id = s.id
      ) AS reactions_count,
      (
        SELECT COUNT(*)::int FROM public.snap_views v
        WHERE v.snap_id = s.id
      ) AS views_count
    FROM public.visible_snaps($2) s
    JOIN public.profiles pr ON pr.id = s.author_id
    WHERE s.id = $1;
  `;
  const result = await db.query(sql, [snapId, viewerId]);
  return result.rows[0];
};

/**
 * Reports whether a snap is currently visible to a viewer.
 *
 * Writes must consult this before touching `snap_views` / `snap_reactions`:
 * reading through `visible_snaps` alone would let any authenticated caller
 * react to an expired, hidden, or out-of-audience snap by id.
 */
const isSnapVisible = async (snapId, viewerId) => {
  const sql = `
    SELECT 1
      FROM public.visible_snaps($2) s
     WHERE s.id = $1
     LIMIT 1;
  `;
  const result = await db.query(sql, [snapId, viewerId]);
  return result.rowCount > 0;
};

/**
 * Records a snap view by a viewer.
 */
const recordView = async (snapId, viewerId) => {
  const sql = `
    INSERT INTO public.snap_views (snap_id, viewer_id, viewed_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (snap_id, viewer_id) DO NOTHING
    RETURNING *;
  `;
  const result = await db.query(sql, [snapId, viewerId]);
  return result.rows[0] || null;
};

/**
 * Records or updates a snap reaction.
 */
const recordReaction = async (snapId, userId, reaction = "heart") => {
  const sql = `
    INSERT INTO public.snap_reactions (snap_id, user_id, reaction, created_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (snap_id, user_id)
    DO UPDATE SET reaction = EXCLUDED.reaction, created_at = NOW()
    RETURNING *;
  `;
  const result = await db.query(sql, [snapId, userId, reaction]);
  return result.rows[0];
};

/**
 * Removes a snap reaction.
 */
const removeReaction = async (snapId, userId) => {
  const sql = `
    DELETE FROM public.snap_reactions
    WHERE snap_id = $1 AND user_id = $2
    RETURNING *;
  `;
  const result = await db.query(sql, [snapId, userId]);
  return result.rows[0] || null;
};

/**
 * Deletes a snap owned by authorId.
 */
const deleteSnap = async (snapId, authorId) => {
  const sql = `
    DELETE FROM public.snaps
    WHERE id = $1 AND author_id = $2
    RETURNING *;
  `;
  const result = await db.query(sql, [snapId, authorId]);
  return result.rows[0] || null;
};

module.exports = {
  createSnap,
  getRailSnaps,
  getUserSnaps,
  getSnapById,
  isSnapVisible,
  recordView,
  recordReaction,
  removeReaction,
  deleteSnap,
};
