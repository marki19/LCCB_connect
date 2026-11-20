const db = require("../db");

/**
 * Comments on a Quick Snap.
 *
 * Visibility is not decided here: the controller asks `snapModel.isSnapVisible`
 * first and only then reaches this module. That keeps one rule in one place.
 */

/**
 * Returns a snap's comments, oldest first, each joined to its author.
 *
 * Deliberately flat. Threads are one level deep, so the client can group by
 * `parent_id` in a single pass; a nested aggregate would cost more than it
 * saves and would make pagination harder later.
 */
const listComments = async (snapId) => {
  const sql = `
    SELECT
      c.id,
      c.snap_id,
      c.author_id,
      c.parent_id,
      c.body,
      c.created_at,
      pr.username,
      pr.full_name,
      pr.avatar_url
    FROM public.snap_comments c
    JOIN public.profiles pr ON pr.id = c.author_id
    WHERE c.snap_id = $1
    ORDER BY c.created_at ASC;
  `;
  const result = await db.query(sql, [snapId]);
  return result.rows;
};

/**
 * Inserts a comment or reply and returns it in the same shape as `listComments`.
 */
const createComment = async ({ snapId, authorId, parentId = null, body }) => {
  const sql = `
    WITH inserted AS (
      INSERT INTO public.snap_comments (snap_id, author_id, parent_id, body)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    )
    SELECT
      i.id,
      i.snap_id,
      i.author_id,
      i.parent_id,
      i.body,
      i.created_at,
      pr.username,
      pr.full_name,
      pr.avatar_url
    FROM inserted i
    JOIN public.profiles pr ON pr.id = i.author_id;
  `;
  const result = await db.query(sql, [snapId, authorId, parentId, body]);
  return result.rows[0];
};

/**
 * True when `parentId` is a top-level comment on this snap.
 *
 * Guards both directions at once: a reply cannot cross to another snap, and a
 * reply cannot nest under another reply.
 */
const parentIsTopLevelOfSnap = async (parentId, snapId) => {
  const sql = `
    SELECT 1
    FROM public.snap_comments
    WHERE id = $1 AND snap_id = $2 AND parent_id IS NULL
    LIMIT 1;
  `;
  const result = await db.query(sql, [parentId, snapId]);
  return result.rowCount > 0;
};

module.exports = {
  listComments,
  createComment,
  parentIsTopLevelOfSnap,
};
