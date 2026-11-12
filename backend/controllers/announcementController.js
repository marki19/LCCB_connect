const announcementModel = require("../models/announcementModel");
const { normalizeRole } = require("../middleware/auth");
const { announcementAudienceSchema } = require("../validation");
const auditService = require("../services/auditService");
const db = require("../db");

const { ACTIONS } = auditService;

/** Audiences that cross departments, so only campus admins may send them. */
const CAMPUS_ONLY_AUDIENCES = new Set(["all", "role"]);

const isCampusAdmin = (profile) => {
  const role = normalizeRole(profile?.role);
  return role === "admin" || role === "superadmin";
};

/**
 * Turns a requested audience into the post's audience columns, applying the
 * caller's scope.
 *
 * Department admins are confined to their own department: `department` must be
 * theirs, `course` must belong to it, and `year_level` is pinned to it so a bare
 * year filter can never leak campus-wide. `all` and `role` cross departments, so
 * they are reserved for campus admins.
 *
 * Returns `{ columns }` or `{ error, status }`.
 */
async function resolveAudience(profile, audience) {
  const campusAdmin = isCampusAdmin(profile);

  if (!campusAdmin) {
    if (CAMPUS_ONLY_AUDIENCES.has(audience.type)) {
      return {
        status: 403,
        error: "Department admins can target a department, course, or year level",
      };
    }
    if (!profile?.department_id) {
      return { status: 403, error: "Your account has no department assigned" };
    }
  }

  switch (audience.type) {
    case "all":
      return { columns: {} };

    case "role":
      return { columns: { audience_role: audience.role } };

    case "department":
      if (!campusAdmin && audience.department_id !== profile.department_id) {
        return { status: 403, error: "You can only target your own department" };
      }
      return { columns: { audience_department_id: audience.department_id } };

    case "course": {
      const course = (
        await db.query(`SELECT department_id FROM public.courses WHERE id = $1::uuid;`, [
          audience.course_id,
        ])
      ).rows[0];
      if (!course) return { status: 400, error: "Unknown course" };
      if (!campusAdmin && course.department_id !== profile.department_id) {
        return { status: 403, error: "You can only target courses in your department" };
      }
      return { columns: { audience_course_id: audience.course_id } };
    }

    case "year_level": {
      const columns = { audience_year_level: audience.year_level };
      if (!campusAdmin) columns.audience_department_id = profile.department_id;
      return { columns };
    }

    default:
      return { status: 400, error: "Unknown audience" };
  }
}

/** Rebuilds the audience object a management screen displays from the columns. */
function shapeAudience(row) {
  if (row.audience_role) return { type: "role", role: row.audience_role };
  if (row.audience_course_id) return { type: "course", course_id: row.audience_course_id };
  if (row.audience_year_level) return { type: "year_level", year_level: row.audience_year_level };
  if (row.audience_department_id) {
    return { type: "department", department_id: row.audience_department_id };
  }
  return { type: "all" };
}

function shapeAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.content,
    audience: shapeAudience(row),
    pinned: row.pinned,
    expires_at: row.expires_at,
    allow_reposts: row.allow_reposts,
    repost_count: row.repost_count,
    author_id: row.author_id,
    created_at: row.created_at,
    edited_at: row.edited_at,
  };
}

/** GET /api/announcements/audience-count?type=…&… — preview the reach. */
const getAudienceCount = async (req, res, next) => {
  try {
    const parsed = audienceFromQuery(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid audience" });
    }

    const resolved = await resolveAudience(req.profile, parsed.data);
    if (resolved.error) return res.status(resolved.status || 403).json({ error: resolved.error });

    const recipients = await announcementModel.resolveRecipients({
      actorId: req.user.id,
      audience: resolved.columns,
    });
    res.json({ count: recipients.length });
  } catch (error) {
    next(error);
  }
};

/** POST /api/announcements — create the post and fan out the notifications. */
const create = async (req, res, next) => {
  try {
    const { title, body, audience, pinned, expires_at } = req.body;

    const resolved = await resolveAudience(req.profile, audience);
    if (resolved.error) return res.status(resolved.status || 403).json({ error: resolved.error });

    const { post, recipients } = await announcementModel.create({
      authorId: req.user.id,
      title,
      body,
      audience: resolved.columns,
      pinned,
      expiresAt: expires_at,
    });

    await auditService.recordRequest(req, {
      action: ACTIONS.ANNOUNCEMENT_SEND,
      targetType: "announcement",
      targetId: post.id,
      targetLabel: title,
      reason: null,
      metadata: { title, body, audience, recipients },
    });

    res.status(201).json({ ...shapeAnnouncement(post), recipients });
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/announcements/:id — edit title, body, pin, expiry. */
const update = async (req, res, next) => {
  try {
    const existing = await announcementModel.getById(req.params.id);
    if (!existing || existing.deleted_at) {
      return res.status(404).json({ error: "Announcement not found" });
    }
    if (existing.author_id !== req.user.id && !isCampusAdmin(req.profile)) {
      return res.status(403).json({ error: "Only the author can edit this announcement" });
    }

    const { title, body, pinned, expires_at } = req.body;
    const post = await announcementModel.update({
      id: existing.id,
      title,
      body,
      pinned,
      expiresAt: expires_at,
    });
    if (!post) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    await auditService.recordRequest(req, {
      action: ACTIONS.ANNOUNCEMENT_UPDATE,
      targetType: "announcement",
      targetId: post.id,
      targetLabel: post.title,
      reason: null,
      metadata: { title, body, pinned, expires_at },
    });

    res.json(shapeAnnouncement(post));
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/announcements/:id — soft-delete the post, purge its bell rows. */
const remove = async (req, res, next) => {
  try {
    const existing = await announcementModel.getById(req.params.id);
    if (!existing || existing.deleted_at) {
      return res.status(404).json({ error: "Announcement not found" });
    }
    if (existing.author_id !== req.user.id && !isCampusAdmin(req.profile)) {
      return res.status(403).json({ error: "Only the author can delete this announcement" });
    }

    await announcementModel.softDelete({ id: existing.id });

    await auditService.recordRequest(req, {
      action: ACTIONS.ANNOUNCEMENT_DELETE,
      targetType: "announcement",
      targetId: existing.id,
      targetLabel: existing.title,
      reason: null,
      metadata: {},
    });

    res.json({ id: existing.id, deleted: true });
  } catch (error) {
    next(error);
  }
};

/** GET /api/announcements — management history, scoped to the caller. */
const list = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10) || 25, 1), 100);
    const result = await announcementModel.list({
      viewerId: req.user.id,
      isCampusAdmin: isCampusAdmin(req.profile),
      departmentId: req.profile?.department_id,
      limit,
      cursor: req.query.cursor ? String(req.query.cursor) : null,
    });

    res.json({
      items: result.items.map(shapeAnnouncement),
      next_cursor: result.next_cursor,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Query strings are flat, so rebuild the audience object the schema expects
 * before validating it with the same union the POST body uses.
 */
function audienceFromQuery(query = {}) {
  const candidate = { type: query.type };
  for (const key of ["role", "department_id", "course_id", "year_level"]) {
    if (query[key] !== undefined) candidate[key] = query[key];
  }
  return announcementAudienceSchema.safeParse(candidate);
}

module.exports = {
  getAudienceCount,
  create,
  update,
  remove,
  list,
  // exported for unit tests
  resolveAudience,
  shapeAudience,
};
