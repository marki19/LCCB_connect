const db = require("../db");

/**
 * List all saved collections for a user, including item count.
 */
const listCollections = async (userId) => {
  const sql = `
    SELECT 
      sc.id,
      sc.name,
      sc.is_private,
      sc.created_at,
      sc.updated_at,
      COUNT(sci.post_id)::int AS item_count,
      (
        SELECT p.image_url 
        FROM public.saved_collection_items sci2
        JOIN public.posts p ON p.id = sci2.post_id
        WHERE sci2.collection_id = sc.id AND p.image_url IS NOT NULL
        LIMIT 1
      ) AS cover_image
    FROM public.saved_collections sc
    LEFT JOIN public.saved_collection_items sci ON sci.collection_id = sc.id
    WHERE sc.user_id = $1
    GROUP BY sc.id
    ORDER BY sc.created_at DESC;
  `;
  const result = await db.query(sql, [userId]);
  return result.rows;
};

/**
 * Create a new saved collection.
 */
const createCollection = async (userId, name, isPrivate = true) => {
  const sql = `
    INSERT INTO public.saved_collections (user_id, name, is_private)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, name, is_private, created_at;
  `;
  const result = await db.query(sql, [userId, name.trim(), Boolean(isPrivate)]);
  return result.rows[0];
};

/**
 * Add a post to a collection (post must be saved first).
 */
const addItemToCollection = async (userId, collectionId, postId) => {
  // Ensure collection belongs to user
  const checkSql = `
    SELECT id FROM public.saved_collections
    WHERE id = $1 AND user_id = $2;
  `;
  const checkRes = await db.query(checkSql, [collectionId, userId]);
  if (!checkRes.rows.length) {
    const err = new Error("Collection not found or access denied");
    err.status = 404;
    throw err;
  }

  // Ensure post is in saved_posts
  const saveEnsureSql = `
    INSERT INTO public.saved_posts (user_id, post_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, post_id) DO NOTHING;
  `;
  await db.query(saveEnsureSql, [userId, postId]);

  const insertSql = `
    INSERT INTO public.saved_collection_items (collection_id, post_id)
    VALUES ($1, $2)
    ON CONFLICT (collection_id, post_id) DO NOTHING
    RETURNING collection_id, post_id, created_at;
  `;
  const res = await db.query(insertSql, [collectionId, postId]);
  return res.rows[0] || { collection_id: collectionId, post_id: postId };
};

/**
 * Remove a post from a collection.
 */
const removeItemFromCollection = async (userId, collectionId, postId) => {
  const checkSql = `
    SELECT id FROM public.saved_collections
    WHERE id = $1 AND user_id = $2;
  `;
  const checkRes = await db.query(checkSql, [collectionId, userId]);
  if (!checkRes.rows.length) {
    const err = new Error("Collection not found or access denied");
    err.status = 404;
    throw err;
  }

  const deleteSql = `
    DELETE FROM public.saved_collection_items
    WHERE collection_id = $1 AND post_id = $2;
  `;
  await db.query(deleteSql, [collectionId, postId]);
  return { success: true };
};

/**
 * Delete an entire collection.
 */
const deleteCollection = async (userId, collectionId) => {
  const sql = `
    DELETE FROM public.saved_collections
    WHERE id = $1 AND user_id = $2
    RETURNING id;
  `;
  const res = await db.query(sql, [collectionId, userId]);
  return { success: Boolean(res.rows.length) };
};

module.exports = {
  listCollections,
  createCollection,
  addItemToCollection,
  removeItemFromCollection,
  deleteCollection,
};
