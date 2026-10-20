const db = require("../db");
const { normalizeRole } = require("../middleware/auth");

/**
 * Read/write queries for the superadmin console. Every query is parameterized.
 * Writes that are specific to governance live here so the general user model
 * stays focused on self-service profile CRUD.
 */

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function clampAdminLimit(raw) {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function splitCursor(cursor) {
  if (!cursor) return null;
  const [createdAt, id] = String(cursor).split("|");
  if (!createdAt || !id) return null;
  return { createdAt, id };
}

const SUSPENDED_SQL = `(p.suspended_at IS NOT NULL AND (p.suspended_until IS NULL OR p.suspended_until > NOW()))`;
const ACTIVE_SQL = `(p.suspended_at IS NULL OR (p.suspended_until IS NOT NULL AND p.suspended_until <= NOW()))`;
const ROLE_NORMALIZED_SQL = `LOWER(REPLACE(REPLACE(p.role, '_', ''), '-', ''))`;

function shapeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    bio: row.bio,
    role: row.role,
    course: row.course,
    course_id: row.course_id,
    course_name: row.course_name,
    year_level: row.year_level,
    department_id: row.department_id,
    department_name: row.department_name,
    skills: row.skills,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    suspended_at: row.suspended_at,
    suspended_until: row.suspended_until,
    suspension_reason: row.suspension_reason,
    suspended_by: row.suspended_by,
    status:
      row.status ||
      (row.suspended_at &&
      (!row.suspended_until || new Date(row.suspended_until).getTime() > Date.now())
        ? "suspended"
        : "active"),
  };
}

async function listUsers({
  q = null,
  role = null,
  departmentId = null,
  status = null,
  limit = DEFAULT_LIMIT,
  cursor = null,
} = {}) {
  const params = [];
  const conditions = [];

  if (q) {
    params.push(`%${q}%`);
    conditions.push(
      `(p.username ILIKE $${params.length} OR p.full_name ILIKE $${params.length})`
    );
  }

  const roleNorm = role ? normalizeRole(role) : null;
  if (roleNorm) {
    params.push(roleNorm);
    conditions.push(`${ROLE_NORMALIZED_SQL} = $${params.length}`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`p.department_id = $${params.length}::uuid`);
  }

  if (status === "suspended") conditions.push(SUSPENDED_SQL);
  if (status === "active") conditions.push(ACTIVE_SQL);

  const after = splitCursor(cursor);
  if (after) {
    params.push(after.createdAt, after.id);
    conditions.push(
      `(p.created_at, p.id) < ($${params.length - 1}::timestamptz, $${params.length}::text)`
    );
  }

  params.push(limit + 1);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.query(
    `SELECT
       p.*,
       d.name AS department_name,
       c.name AS course_name,
       CASE WHEN ${SUSPENDED_SQL} THEN 'suspended' ELSE 'active' END AS status,
       CAST(COUNT(*) OVER () AS INTEGER) AS total_count
     FROM public.profiles p
     LEFT JOIN public.departments d ON d.id = p.department_id
     LEFT JOIN public.courses c ON c.id = p.course_id
     ${where}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $${params.length};`,
    params
  );

  const rows = result.rows;
  const total = rows[0]?.total_count ?? 0;
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  const last = rows[rows.length - 1];
  return {
    items: rows.map(shapeUser),
    total,
    next_cursor: hasMore && last
      ? `${new Date(last.created_at).toISOString()}|${last.id}`
      : null,
  };
}

async function getUserById(id) {
  const result = await db.query(
    `SELECT p.*, d.name AS department_name, c.name AS course_name,
            CASE WHEN ${SUSPENDED_SQL} THEN 'suspended' ELSE 'active' END AS status
       FROM public.profiles p
       LEFT JOIN public.departments d ON d.id = p.department_id
       LEFT JOIN public.courses c ON c.id = p.course_id
      WHERE p.id = $1;`,
    [id]
  );
  return shapeUser(result.rows[0]);
}

async function getUserDossier(id, { includeAudit = false } = {}) {
  const [profile, counts, content, sanctions] = await Promise.all([
    getUserById(id),
    db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM public.posts WHERE author_id = $1) AS posts,
         (SELECT COUNT(*)::int FROM public.theses WHERE uploader_id = $1) AS theses,
         (SELECT COUNT(*)::int FROM public.comments WHERE user_id = $1) AS comments,
         (SELECT COUNT(*)::int FROM public.likes WHERE user_id = $1) AS likes_given,
         (SELECT COUNT(*)::int
            FROM public.message_reports r
            JOIN public.messages m ON m.id = r.message_id
           WHERE m.sender_id = $1) AS message_reports_against;`,
      [id]
    ),
    db.query(
      `SELECT * FROM (
         SELECT 'post'::text AS type, p.id::text AS id,
                COALESCE(NULLIF(p.title, ''), LEFT(COALESCE(p.content, ''), 100)) AS title,
                p.moderation_status AS status, p.created_at,
                ('/post/' || p.id)::text AS app_path
           FROM public.posts p WHERE p.author_id = $1
         UNION ALL
         SELECT 'thesis', t.id::text, t.title, t.moderation_status, t.created_at, NULL::text
           FROM public.theses t WHERE t.uploader_id = $1
       ) items
       ORDER BY created_at DESC
       LIMIT 5;`,
      [id]
    ),
    includeAudit
      ? db.query(
          `SELECT id, action, reason, metadata, actor_id, actor_username,
                  actor_role, created_at
             FROM public.admin_audit_log
            WHERE target_type = 'user' AND target_id = $1
            ORDER BY created_at DESC
            LIMIT 10;`,
          [id]
        )
      : Promise.resolve({ rows: [] }),
  ]);

  if (!profile) return null;
  return {
    ...profile,
    counts: counts.rows[0] || {
      posts: 0,
      theses: 0,
      comments: 0,
      likes_given: 0,
      message_reports_against: 0,
    },
    recent_content: content.rows,
    sanctions: sanctions.rows,
  };
}

async function setUserSuspension(id, { reason, until, actorId }) {
  const result = await db.query(
    `UPDATE public.profiles
        SET suspended_at = NOW(),
            suspended_until = $2::timestamptz,
            suspension_reason = $3,
            suspended_by = $4
      WHERE id = $1
      RETURNING *;`,
    [id, until || null, reason, actorId]
  );
  return shapeUser(result.rows[0]);
}

async function clearUserSuspension(id) {
  const result = await db.query(
    `UPDATE public.profiles
        SET suspended_at = NULL,
            suspended_until = NULL,
            suspension_reason = NULL,
            suspended_by = NULL
      WHERE id = $1
      RETURNING *;`,
    [id]
  );
  return shapeUser(result.rows[0]);
}

const CONTENT_CTE = `
  WITH content_items AS (
    SELECT 'post'::text AS type, p.id, 
           COALESCE(NULLIF(p.title, ''), LEFT(COALESCE(p.content, ''), 120)) AS title,
           LEFT(COALESCE(p.content, ''), 240) AS excerpt,
           p.moderation_status AS status, p.moderation_reason, p.created_at,
           p.author_id, pr.username, pr.full_name,
           pr.department_id, d.name AS department_name,
           NULL::uuid AS parent_id,
           ('/post/' || p.id)::text AS app_path
      FROM public.posts p
      LEFT JOIN public.profiles pr ON pr.id = p.author_id
      LEFT JOIN public.departments d ON d.id = pr.department_id
    UNION ALL
    SELECT 'thesis', t.id, t.title, LEFT(t.abstract, 240),
           t.moderation_status, t.moderation_reason, t.created_at,
           t.uploader_id, pr.username, pr.full_name,
           pr.department_id, d.name,
           NULL::uuid, NULL::text
      FROM public.theses t
      LEFT JOIN public.profiles pr ON pr.id = t.uploader_id
      LEFT JOIN public.departments d ON d.id = pr.department_id
    UNION ALL
    SELECT 'comment', c.id, LEFT(c.content, 120), LEFT(c.content, 240),
           c.moderation_status, c.moderation_reason, c.created_at,
           c.user_id, pr.username, pr.full_name,
           pr.department_id, d.name,
           c.post_id, ('/post/' || c.post_id)::text
      FROM public.comments c
      LEFT JOIN public.profiles pr ON pr.id = c.user_id
      LEFT JOIN public.departments d ON d.id = pr.department_id
  )`;

async function listContent({
  type = "all",
  status = "all",
  q = null,
  departmentId = null,
  authorId = null,
  limit = DEFAULT_LIMIT,
  cursor = null,
} = {}) {
  const params = [];
  const conditions = [];

  if (type && type !== "all") {
    params.push(type);
    conditions.push(`ci.type = $${params.length}`);
  }
  if (status && status !== "all") {
    params.push(status);
    conditions.push(`ci.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(
      `(ci.title ILIKE $${params.length} OR ci.excerpt ILIKE $${params.length})`
    );
  }
  if (departmentId) {
    params.push(departmentId);
    conditions.push(`ci.department_id = $${params.length}::uuid`);
  }
  if (authorId) {
    params.push(authorId);
    conditions.push(`ci.author_id = $${params.length}`);
  }

  const after = splitCursor(cursor);
  if (after) {
    params.push(after.createdAt, after.id);
    conditions.push(
      `(ci.created_at, ci.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`
    );
  }

  params.push(limit + 1);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.query(
    `${CONTENT_CTE}
     SELECT ci.*, CAST(COUNT(*) OVER () AS INTEGER) AS total_count
       FROM content_items ci
       ${where}
      ORDER BY ci.created_at DESC, ci.id DESC
      LIMIT $${params.length};`,
    params
  );

  const rows = result.rows;
  const total = rows[0]?.total_count ?? 0;
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  const last = rows[rows.length - 1];

  return {
    items: rows.map((row) => ({
      type: row.type,
      id: row.id,
      title: row.title || (row.type === "comment" ? "Comment" : "Untitled"),
      excerpt: row.excerpt || "",
      author: {
        id: row.author_id,
        username: row.username,
        full_name: row.full_name,
      },
      department_id: row.department_id,
      department_name: row.department_name,
      status: row.status,
      moderation_reason: row.moderation_reason,
      created_at: row.created_at,
      app_path: row.app_path,
      parent_id: row.parent_id,
    })),
    total,
    next_cursor: hasMore && last
      ? `${new Date(last.created_at).toISOString()}|${last.id}`
      : null,
  };
}

async function listAudit({
  actorId = null,
  action = null,
  targetType = null,
  targetId = null,
  from = null,
  to = null,
  q = null,
  limit = 25,
  cursor = null,
} = {}) {
  const params = [];
  const conditions = [];

  if (actorId) {
    params.push(actorId);
    conditions.push(`a.actor_id = $${params.length}`);
  }
  if (action) {
    params.push(action);
    conditions.push(`a.action = $${params.length}`);
  }
  if (targetType) {
    params.push(targetType);
    conditions.push(`a.target_type = $${params.length}`);
  }
  if (targetId) {
    params.push(targetId);
    conditions.push(`a.target_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`a.created_at >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(to);
    conditions.push(`a.created_at <= $${params.length}::timestamptz`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(
      `(a.target_label ILIKE $${params.length} OR a.actor_username ILIKE $${params.length} OR a.reason ILIKE $${params.length})`
    );
  }

  const after = splitCursor(cursor);
  if (after) {
    params.push(after.createdAt, after.id);
    conditions.push(
      `(a.created_at, a.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`
    );
  }

  params.push(limit + 1);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.query(
    `SELECT a.*, CAST(COUNT(*) OVER () AS INTEGER) AS total_count
       FROM public.admin_audit_log a
       ${where}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $${params.length};`,
    params
  );

  const rows = result.rows;
  const total = rows[0]?.total_count ?? 0;
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  const last = rows[rows.length - 1];

  return {
    items: rows.map((row) => ({
      id: row.id,
      actor_id: row.actor_id,
      actor_username: row.actor_username,
      actor_role: row.actor_role,
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      target_label: row.target_label,
      reason: row.reason,
      metadata: row.metadata,
      created_at: row.created_at,
    })),
    total,
    next_cursor: hasMore && last
      ? `${new Date(last.created_at).toISOString()}|${last.id}`
      : null,
  };
}

async function getOverview() {
  const [users, content, reports, announcements, attention] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE ${ROLE_NORMALIZED_SQL} = 'student')::int AS students,
         COUNT(*) FILTER (WHERE ${ROLE_NORMALIZED_SQL} = 'faculty')::int AS faculty,
         COUNT(*) FILTER (WHERE ${ROLE_NORMALIZED_SQL} = 'departmentadmin')::int AS department_admins,
         COUNT(*) FILTER (WHERE ${ROLE_NORMALIZED_SQL} = 'admin')::int AS admins,
         COUNT(*) FILTER (WHERE ${ROLE_NORMALIZED_SQL} = 'superadmin')::int AS superadmins,
         COUNT(*) FILTER (WHERE ${SUSPENDED_SQL})::int AS suspended,
         COUNT(*) FILTER (WHERE p.last_seen_at >= NOW() - INTERVAL '7 days')::int AS active_7d,
         COUNT(*) FILTER (WHERE p.created_at >= NOW() - INTERVAL '7 days')::int AS new_7d
       FROM public.profiles p;`
    ),
    db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM public.posts) AS posts,
         (SELECT COUNT(*)::int FROM public.theses) AS theses,
         (SELECT COUNT(*)::int FROM public.comments) AS comments,
         ((SELECT COUNT(*)::int FROM public.posts WHERE moderation_status = 'hidden')
          + (SELECT COUNT(*)::int FROM public.theses WHERE moderation_status = 'hidden')
          + (SELECT COUNT(*)::int FROM public.comments WHERE moderation_status = 'hidden')) AS hidden,
         ((SELECT COUNT(*)::int FROM public.posts WHERE moderation_status = 'flagged')
          + (SELECT COUNT(*)::int FROM public.theses WHERE moderation_status = 'flagged')
          + (SELECT COUNT(*)::int FROM public.comments WHERE moderation_status = 'flagged')) AS flagged;`
    ),
    db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM public.message_reports WHERE status = 'open') AS message_reports,
         (SELECT COUNT(*)::int FROM public.posts WHERE moderation_status = 'flagged') AS flagged_posts,
         (SELECT COUNT(*)::int FROM public.comments WHERE moderation_status = 'flagged') AS flagged_comments,
         (SELECT COUNT(*)::int FROM public.theses WHERE moderation_status = 'flagged') AS flagged_theses;`
    ),
    db.query(
      `SELECT
         COUNT(*)::int AS sent_30d,
         COALESCE(SUM((metadata->>'recipients')::int), 0)::int AS recipients_30d
       FROM public.admin_audit_log
      WHERE action = 'announcement.send'
        AND created_at >= NOW() - INTERVAL '30 days';`
    ),
    db.query(
      `SELECT * FROM (
         SELECT 'flagged_post'::text AS kind, p.id::text AS id,
                COALESCE(NULLIF(p.title, ''), LEFT(COALESCE(p.content, ''), 100)) AS label,
                pr.full_name AS author, p.created_at
           FROM public.posts p
           LEFT JOIN public.profiles pr ON pr.id = p.author_id
          WHERE p.moderation_status = 'flagged'
         UNION ALL
         SELECT 'flagged_comment', c.id::text, LEFT(c.content, 100),
                pr.full_name, c.created_at
           FROM public.comments c
           LEFT JOIN public.profiles pr ON pr.id = c.user_id
          WHERE c.moderation_status = 'flagged'
         UNION ALL
         SELECT 'flagged_thesis', t.id::text, t.title,
                pr.full_name, t.created_at
           FROM public.theses t
           LEFT JOIN public.profiles pr ON pr.id = t.uploader_id
          WHERE t.moderation_status = 'flagged'
         UNION ALL
         SELECT 'message_report', r.id::text, LEFT(m.body, 100),
                sender.full_name, r.created_at
           FROM public.message_reports r
           JOIN public.messages m ON m.id = r.message_id
           LEFT JOIN public.profiles sender ON sender.id = m.sender_id
          WHERE r.status = 'open'
       ) items
       ORDER BY created_at ASC
       LIMIT 10;`
    ),
  ]);

  return {
    users: users.rows[0],
    content: content.rows[0],
    reports: reports.rows[0],
    announcements: announcements.rows[0],
    needs_attention: attention.rows,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Resolves an announcement audience to active, non-suspended recipients,
 * excluding the sender. Both filters are nullable; passing neither means all.
 */
async function getAnnouncementRecipients({ actorId, role = null, departmentId = null }) {
  const roleNorm = role ? normalizeRole(role) : null;
  const result = await db.query(
    `SELECT p.id, p.full_name, p.username, d.name AS department_name
       FROM public.profiles p
       LEFT JOIN public.departments d ON d.id = p.department_id
      WHERE p.id <> $1
        AND NOT (${SUSPENDED_SQL})
        AND ($2::text IS NULL OR ${ROLE_NORMALIZED_SQL} = $2)
        AND ($3::uuid IS NULL OR p.department_id = $3::uuid)
      ORDER BY p.id;`,
    [actorId, roleNorm, departmentId || null]
  );
  return result.rows;
}

async function createAnnouncementNotifications({
  recipients,
  actorId,
  announcementId,
  departmentId = null,
  departmentName = null,
  message,
}) {
  if (!recipients || recipients.length === 0) return 0;
  const result = await db.query(
    `INSERT INTO public.notifications
       (user_id, actor_id, type, target_id, department_id, department, message)
     SELECT recipient, $2, 'announcement', $3::uuid, $4::uuid, $5, $6
       FROM UNNEST($1::text[]) AS recipient;`,
    [recipients, actorId, announcementId, departmentId || null, departmentName, message]
  );
  return result.rowCount || 0;
}

async function getDepartmentName(id) {
  if (!id) return null;
  const result = await db.query(
    "SELECT name FROM public.departments WHERE id = $1::uuid;",
    [id]
  );
  return result.rows[0]?.name || null;
}

async function listAnnouncementHistory({ limit = 25, cursor = null } = {}) {
  const audit = await listAudit({
    action: "announcement.send",
    limit,
    cursor,
  });
  return {
    items: audit.items.map((row) => ({
      id: row.target_id || row.id,
      title: row.metadata?.title || row.target_label || "Announcement",
      body: row.metadata?.body || "",
      audience: row.metadata?.audience || { type: "all" },
      recipients: row.metadata?.recipients || 0,
      actor_username: row.actor_username,
      created_at: row.created_at,
    })),
    total: audit.total,
    next_cursor: audit.next_cursor,
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  clampAdminLimit,
  listUsers,
  getUserById,
  getUserDossier,
  setUserSuspension,
  clearUserSuspension,
  listContent,
  listAudit,
  getOverview,
  getAnnouncementRecipients,
  createAnnouncementNotifications,
  getDepartmentName,
  listAnnouncementHistory,
};
