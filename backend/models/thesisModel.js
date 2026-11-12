const db = require("../db");
const { DEFAULT_LIMIT } = require("./pagination");
const { escapeLike } = require("../utils/queryFilters");

// RAW SQL QUERIES FOR THESES / MANUSCRIPTS

// Keyset pagination. Pass `cursor` = "<created_at>|<id>" of the last row you
// saw; results are capped by models/pagination.js.
//
// `viewerId` is the visibility viewer: reads go through `visible_theses()`, the
// single copy of the public/friends/custom/private rule. `includeHidden: true`
// reads the base table instead, for moderation.
const getAllTheses = async ({
  limit = DEFAULT_LIMIT,
  cursor = null,
  includeHidden = false,
  q = null,
  uploaderId = null,
  categories = null,
  departmentId = null,
  viewerId = null,
} = {}) => {
  const params = [];
  const conditions = [];

  if (cursor) {
    const [createdAt, id] = String(cursor).split("|");
    if (createdAt && id) {
      params.push(createdAt, id);
      conditions.push(`(
      t.created_at < $1::timestamptz
      OR (t.created_at = $1::timestamptz AND t.id < $2::uuid)
    )`);
    }
  }

  if (q) {
    params.push(`%${escapeLike(q)}%`);
    conditions.push(`(
      t.title ILIKE $${params.length} ESCAPE '!'
      OR t.abstract ILIKE $${params.length} ESCAPE '!'
      OR pr.full_name ILIKE $${params.length} ESCAPE '!'
      OR d.name ILIKE $${params.length} ESCAPE '!'
    )`);
  }

  if (uploaderId) {
    params.push(uploaderId);
    conditions.push(`t.uploader_id = $${params.length}::text`);
  }

  if (Array.isArray(categories) && categories.length > 0) {
    params.push(categories);
    conditions.push(`t.category = ANY($${params.length}::text[])`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`(t.department_id = $${params.length}::uuid OR pr.department_id = $${params.length}::uuid)`);
  }

  const whereClause = conditions.length
    ? `\n    WHERE ${conditions.join("\n      AND ")}`
    : "";

  // Appended last so the filter indexes above stay stable.
  let fromClause = "FROM theses t";
  if (!includeHidden) {
    params.push(viewerId);
    fromClause = `FROM visible_theses($${params.length}::text) t`;
  }

  params.push(limit);
  const sql = `
    SELECT 
      t.id,
      t.uploader_id,
      t.title,
      t.abstract,
      t.department_id,
      t.department,
      t.category,
      t.pdf_url,
      t.visibility,
      t.created_at,
      t.moderation_status,
      t.moderation_reason,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'course', pr.course,
        'year_level', pr.year_level,
        'department_id', pr.department_id,
        'department_name', d.name
      ) AS uploader
    ${fromClause}
    LEFT JOIN profiles pr ON t.uploader_id = pr.id
    LEFT JOIN public.departments d ON d.id = pr.department_id${whereClause}
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT $${params.length};
  `;
  const result = await db.query(sql, params);
  return result.rows;
};

const getThesisById = async (id, { includeHidden = false, viewerId = null } = {}) => {
  const params = [id];

  let fromClause = "FROM theses t";
  if (!includeHidden) {
    params.push(viewerId);
    fromClause = `FROM visible_theses($${params.length}::text) t`;
  }

  const sql = `
    SELECT 
      t.id,
      t.uploader_id,
      t.title,
      t.abstract,
      t.department_id,
      t.department,
      t.category,
      t.pdf_url,
      t.visibility,
      t.created_at,
      t.moderation_status,
      t.moderation_reason,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'department_id', pr.department_id,
        'department_name', d.name
      ) AS uploader
    ${fromClause}
    LEFT JOIN profiles pr ON t.uploader_id = pr.id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE t.id = $1;
  `;
  const result = await db.query(sql, params);
  return result.rows[0];
};

// ---- visibility + audience -------------------------------------------------

/** Replaces the custom audience list for a thesis, inside the caller's transaction. */
const setThesisAudience = async (client, thesisId, userIds) => {
  await client.query(
    "DELETE FROM public.thesis_audience WHERE thesis_id = $1::uuid",
    [thesisId]
  );
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  await client.query(
    `INSERT INTO public.thesis_audience (thesis_id, user_id)
     SELECT $1::uuid, unnest($2::text[])
     ON CONFLICT DO NOTHING;`,
    [thesisId, userIds]
  );
};

const createThesis = async (thesisData) => {
  // `department_id` (catalog) is derived by the controller from the uploader's
  // profile; `department` is its denormalized display name.
  const {
    uploader_id,
    title,
    abstract,
    department_id,
    department,
    category,
    pdf_url,
    visibility = "public",
    audience = null,
  } = thesisData;

  return db.withTransaction(async (client) => {
    const sql = `
      INSERT INTO theses (uploader_id, title, abstract, department_id, department, category, pdf_url, visibility)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      uploader_id,
      title,
      abstract,
      department_id || null,
      department || null,
      category,
      pdf_url,
      visibility,
    ];
    const result = await client.query(sql, values);
    const thesis = result.rows[0];
    if (thesis.visibility === "custom") {
      await setThesisAudience(client, thesis.id, audience);
    }
    return thesis;
  });
};

// Columns a caller may change (fixed whitelist — no client input reaches SQL).
// Department is NOT here: it is derived from the uploader's profile, not chosen.
const THESIS_UPDATABLE_COLUMNS = [
  "title",
  "abstract",
  "category",
  "pdf_url",
  "visibility",
];

// Partial update: only the columns present in `thesisData` are written, so an
// omitted field keeps its current value. An explicit `null` clears a field.
// Ownership is enforced in SQL: the row is only updated when it belongs to
// `uploaderId`. A caller who does not own the thesis gets no row back (=> 404).
//
// The audience list is only rewritten when `visibility`/`audience` is sent, so
// an unrelated edit cannot silently wipe it.
const updateThesis = async (id, uploaderId, thesisData) => {
  const fields = THESIS_UPDATABLE_COLUMNS.filter(
    (column) => thesisData[column] !== undefined
  );
  const touchesAudience =
    thesisData.audience !== undefined || thesisData.visibility !== undefined;

  if (fields.length === 0 && !touchesAudience) {
    const current = await db.query(
      `SELECT * FROM theses WHERE id = $1 AND uploader_id = $2;`,
      [id, uploaderId]
    );
    return current.rows[0];
  }

  return db.withTransaction(async (client) => {
    let thesis;

    if (fields.length > 0) {
      const setClause = fields.map((column, i) => `${column} = $${i + 1}`).join(", ");
      const values = fields.map((column) => thesisData[column]);
      values.push(id, uploaderId);

      const result = await client.query(
        `
          UPDATE theses
          SET ${setClause}
          WHERE id = $${fields.length + 1} AND uploader_id = $${fields.length + 2}
          RETURNING *;
        `,
        values
      );
      thesis = result.rows[0];
    } else {
      const current = await client.query(
        `SELECT * FROM theses WHERE id = $1 AND uploader_id = $2;`,
        [id, uploaderId]
      );
      thesis = current.rows[0];
    }

    if (!thesis) return undefined;

    if (thesis.visibility === "custom") {
      if (thesisData.audience !== undefined) {
        await setThesisAudience(client, thesis.id, thesisData.audience);
      }
    } else {
      await setThesisAudience(client, thesis.id, []);
    }

    return thesis;
  });
};


const deleteThesis = async (id, uploaderId) => {
  const sql = `DELETE FROM theses WHERE id = $1 AND uploader_id = $2 RETURNING *;`;
  const result = await db.query(sql, [id, uploaderId]);
  return result.rows[0];
};

/**
 * The stored object key of a thesis' manuscript, if one was deposited.
 * Used by the delete path so the file can be removed from Storage when the
 * row goes — a deleted thesis must not leave an orphaned 50 MB PDF behind.
 */
const getThesisFileKey = async (id) => {
  const result = await db.query(
    `SELECT pdf_url FROM public.theses WHERE id = $1;`,
    [id]
  );
  return result.rows[0]?.pdf_url || null;
};

// ---- MODERATION ------------------------------------------------------------

const getFlaggedTheses = async ({ departmentId = null } = {}) => {
  const params = [];
  let deptCondition = "";
  if (departmentId) {
    params.push(departmentId);
    deptCondition = `AND pr.department_id = $${params.length}::uuid`;
  }

  const sql = `
    SELECT
      t.id, t.uploader_id, t.title, t.abstract, t.department_id, t.department,
      t.category, t.pdf_url, t.visibility, t.created_at, t.moderation_status, t.moderation_reason,
      json_build_object(
        'id', pr.id,
        'username', pr.username,
        'full_name', pr.full_name,
        'avatar_url', pr.avatar_url,
        'department_id', pr.department_id,
        'department_name', d.name
      ) AS uploader
    FROM public.theses t
    LEFT JOIN public.profiles pr ON pr.id = t.uploader_id
    LEFT JOIN public.departments d ON d.id = pr.department_id
    WHERE t.moderation_status = 'flagged' ${deptCondition}
    ORDER BY t.created_at ASC;
  `;
  const result = await db.query(sql, params);
  return result.rows;
};

const updateThesisModeration = async (id, status, reason) => {
  const result = await db.query(
    `UPDATE public.theses
        SET moderation_status = $2, moderation_reason = $3
      WHERE id = $1
      RETURNING *;`,
    [id, status, reason]
  );
  return result.rows[0];
};

const adminDeleteThesis = async (id) => {
  const result = await db.query(
    "DELETE FROM public.theses WHERE id = $1 RETURNING *;",
    [id]
  );
  return result.rows[0];
};

module.exports = {
  getAllTheses,
  getThesisById,
  createThesis,
  updateThesis,
  deleteThesis,
  getThesisFileKey,
  getFlaggedTheses,
  updateThesisModeration,
  adminDeleteThesis,
};
