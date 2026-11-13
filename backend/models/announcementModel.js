const db = require("../db");
const { SUSPENDED_SQL, ROLE_NORMALIZED_SQL } = require("./sqlFragments");

/**
 * Announcements (041_announcement_posts.sql).
 *
 * An announcement is a `posts` row with type='announcement' and
 * visibility='announcement'. It owns its INSERT rather than reusing
 * postModel.createPost: the audience columns, pinning and expiry are not part of
 * the generic post shape, and threading six more options through that function
 * would make it the union of two aggregates.
 *
 * Audience is five nullable columns. NULL means "unconstrained", so a single
 * predicate matches every audience type — and the same predicate resolves the
 * notification recipients, which is what keeps the bell and the feed in sync.
 */

const ANNOUNCEMENT_COLUMNS = `
  p.id,
  p.author_id,
  p.title,
  p.content,
  p.visibility,
  p.audience_role,
  p.audience_department_id,
  p.audience_course_id,
  p.audience_year_level,
  p.pinned,
  p.expires_at,
  p.allow_reposts,
  p.repost_count,
  p.created_at,
  p.edited_at,
  p.deleted_at
`;

/**
 * `$1` role, `$2` department, `$3` course, `$4` year level — each NULL means
 * "any". Assumes profiles is aliased `p`.
 */
const AUDIENCE_FILTER_SQL = `
  ($1::text IS NULL OR ${ROLE_NORMALIZED_SQL} = public.normalize_role($1))
  AND ($2::uuid IS NULL OR p.department_id = $2::uuid)
  AND ($3::uuid IS NULL OR p.course_id = $3::uuid)
  AND ($4::text IS NULL OR p.year_level = $4)
`;

function audienceParams(audience = {}) {
  return [
    audience.audience_role || null,
    audience.audience_department_id || null,
    audience.audience_course_id || null,
    audience.audience_year_level || null,
  ];
}

/** Active, non-suspended profiles matching the audience, excluding the sender. */
async function resolveRecipients({ actorId, audience }, client = db) {
  const result = await client.query(
    `SELECT p.id, p.full_name, p.username, d.name AS department_name
       FROM public.profiles p
       LEFT JOIN public.departments d ON d.id = p.department_id
      WHERE p.id <> $5
        AND NOT (${SUSPENDED_SQL})
        AND ${AUDIENCE_FILTER_SQL}
      ORDER BY p.id;`,
    [...audienceParams(audience), actorId]
  );
  return result.rows;
}

/**
 * Creates the announcement post and its notification fan-out in one transaction,
 * so a post can never exist without the bell firing (or the reverse).
 */
async function create({ authorId, title, body, audience, pinned = false, expiresAt = null }) {
  return db.withTransaction(async (client) => {
    const author = (
      await client.query(
        `SELECT department_id, course_id FROM public.profiles WHERE id = $1;`,
        [authorId]
      )
    ).rows[0];
    if (!author) {
      throw Object.assign(new Error("Profile not found"), { status: 404 });
    }

    const post = (
      await client.query(
        `INSERT INTO public.posts (
           author_id, content, type, title, visibility,
           author_department_id, author_course_id,
           audience_role, audience_department_id, audience_course_id,
           audience_year_level, pinned, expires_at,
           moderation_status, allow_reposts
         )
         VALUES (
           $1, $2, 'announcement', $3, 'announcement',
           $4, $5, $6, $7, $8, $9, $10, $11,
           'approved', TRUE
         )
         RETURNING *;`,
        [
          authorId,
          body,
          title,
          author.department_id || null,
          author.course_id || null,
          ...audienceParams(audience),
          pinned,
          expiresAt,
        ]
      )
    ).rows[0];

    const recipients = await resolveRecipients({ actorId: authorId, audience }, client);

    if (recipients.length > 0) {
      const departmentName = audience.audience_department_id
        ? (
            await client.query(`SELECT name FROM public.departments WHERE id = $1::uuid;`, [
              audience.audience_department_id,
            ])
          ).rows[0]?.name || null
        : null;

      await client.query(
        `INSERT INTO public.notifications
           (user_id, actor_id, type, target_id, department_id, department, message)
         SELECT recipient, $2, 'announcement', $3::uuid, $4::uuid, $5, $6
           FROM UNNEST($1::text[]) AS recipient;`,
        [
          recipients.map((r) => r.id),
          authorId,
          post.id,
          audience.audience_department_id || null,
          departmentName,
          `${title}\n\n${body}`,
        ]
      );
    }

    return { post, recipients: recipients.length, recipientIds: recipients.map((r) => r.id) };
  });
}

/**
 * Edits an announcement after it was sent.
 *
 * Audience is deliberately not editable: the notification fan-out is a snapshot,
 * so a new audience could neither un-notify nor notify retroactively. Delete and
 * repost to change who sees it.
 *
 * The notification body is rewritten in the same transaction so the bell and the
 * feed never disagree.
 *
 * `expiresAt` uses three states: `undefined` leaves the current expiry alone,
 * `null` clears it, a timestamp sets it.
 */
async function update({ id, title, body, pinned, expiresAt }) {
  return db.withTransaction(async (client) => {
    const post = (
      await client.query(
        `UPDATE public.posts
            SET title = COALESCE($2, title),
                content = COALESCE($3, content),
                pinned = COALESCE($4, pinned),
                expires_at = CASE WHEN $5::boolean THEN $6::timestamptz ELSE expires_at END,
                edited_at = NOW(),
                updated_at = NOW()
          WHERE id = $1::uuid
            AND type = 'announcement'
            AND deleted_at IS NULL
          RETURNING *;`,
        [id, title ?? null, body ?? null, pinned ?? null, expiresAt !== undefined, expiresAt ?? null]
      )
    ).rows[0];

    if (!post) return null;

    await client.query(
      `UPDATE public.notifications
          SET message = $2
        WHERE type = 'announcement'
          AND target_id = $1::uuid;`,
      [post.id, `${post.title}\n\n${post.content}`]
    );

    return post;
  });
}

/**
 * Soft-deletes the post and hard-deletes its notification rows: a bell entry
 * that opens a missing post is worse than no bell entry.
 */
async function softDelete({ id }) {
  return db.withTransaction(async (client) => {
    const post = (
      await client.query(
        `UPDATE public.posts
            SET deleted_at = NOW()
          WHERE id = $1::uuid
            AND type = 'announcement'
            AND deleted_at IS NULL
          RETURNING id;`,
        [id]
      )
    ).rows[0];

    if (!post) return null;

    await client.query(
      `DELETE FROM public.notifications
        WHERE type = 'announcement' AND target_id = $1::uuid;`,
      [id]
    );

    return post;
  });
}

async function getById(id) {
  const result = await db.query(
    `SELECT ${ANNOUNCEMENT_COLUMNS}
       FROM public.posts p
      WHERE p.id = $1::uuid AND p.type = 'announcement';`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Management history. Department admins see their own announcements plus their
 * department's; campus admins see everything.
 */
async function list({ viewerId, isCampusAdmin, departmentId, limit = 25, cursor = null }) {
  const params = [viewerId, isCampusAdmin, departmentId || null, limit + 1];
  let cursorClause = "";
  if (cursor) {
    params.push(cursor);
    cursorClause = `AND p.created_at < $${params.length}::timestamptz`;
  }

  const result = await db.query(
    `SELECT ${ANNOUNCEMENT_COLUMNS}
       FROM public.posts p
      WHERE p.type = 'announcement'
        AND p.deleted_at IS NULL
        AND (
          $2::boolean
          OR p.author_id = $1
          OR ($3::uuid IS NOT NULL AND p.author_department_id = $3::uuid)
        )
        ${cursorClause}
      ORDER BY p.pinned DESC, p.created_at DESC
      LIMIT $4;`,
    params
  );

  const rows = result.rows;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: page,
    next_cursor: hasMore ? page[page.length - 1].created_at : null,
  };
}

module.exports = {
  resolveRecipients,
  create,
  update,
  softDelete,
  getById,
  list,
};
