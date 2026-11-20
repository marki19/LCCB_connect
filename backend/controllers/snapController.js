const snapModel = require("../models/snapModel");

/**
 * Creates a new snap.
 */
const createSnap = async (req, res, next) => {
  try {
    const { media_key, media_type, caption, visibility } = req.body;
    const authorId = req.user.id;
    const authorDepartmentId = req.profile?.department_id || null;

    const snap = await snapModel.createSnap({
      authorId,
      mediaKey: media_key,
      mediaType: media_type,
      caption: caption || null,
      visibility: visibility || "public",
      authorDepartmentId,
    });

    res.status(201).json(snap);
  } catch (error) {
    next(error);
  }
};

/**
 * Returns grouped rail of active snaps for viewer's feed.
 */
const getRail = async (req, res, next) => {
  try {
    const viewerId = req.user.id;
    const rail = await snapModel.getRailSnaps(viewerId);
    res.json(rail);
  } catch (error) {
    next(error);
  }
};

/**
 * Returns active snaps for a specific user.
 */
const getUserSnaps = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    const viewerId = req.user.id;
    const snaps = await snapModel.getUserSnaps(targetUserId, viewerId);
    res.json(snaps);
  } catch (error) {
    next(error);
  }
};

/**
 * Returns a single snap by ID.
 */
const getSnap = async (req, res, next) => {
  try {
    const snapId = req.params.id;
    const viewerId = req.user.id;
    const snap = await snapModel.getSnapById(snapId, viewerId);
    if (!snap) {
      return res.status(404).json({ error: "Snap not found or expired" });
    }
    res.json(snap);
  } catch (error) {
    next(error);
  }
};

/**
 * Verifies the caller may act on this snap before any write.
 *
 * Snap reads already go through `visible_snaps`, but a write addressed by id
 * would otherwise bypass that: an expired, hidden, or out-of-audience snap is
 * still a valid `snap_views` / `snap_reactions` target. Sends 404 itself so an
 * invisible snap is indistinguishable from a missing one, and returns `false`
 * so the caller can stop.
 */
async function requireVisibleSnap(req, res) {
  const visible = await snapModel.isSnapVisible(req.params.id, req.user.id);
  if (!visible) {
    res.status(404).json({ error: "Snap not found or expired" });
    return false;
  }
  return true;
}

/**
 * Records a snap view by the current user.
 */
const recordView = async (req, res, next) => {
  try {
    if (!(await requireVisibleSnap(req, res))) return;
    const snapId = req.params.id;
    const viewerId = req.user.id;
    const view = await snapModel.recordView(snapId, viewerId);
    res.json({ success: true, view });
  } catch (error) {
    next(error);
  }
};

/**
 * Records or updates a reaction on a snap.
 */
const react = async (req, res, next) => {
  try {
    if (!(await requireVisibleSnap(req, res))) return;
    const snapId = req.params.id;
    const userId = req.user.id;
    const reaction = req.body?.reaction || "heart";
    const result = await snapModel.recordReaction(snapId, userId, reaction);
    res.json({ success: true, reaction: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Removes reaction on a snap.
 */
const unreact = async (req, res, next) => {
  try {
    if (!(await requireVisibleSnap(req, res))) return;
    const snapId = req.params.id;
    const userId = req.user.id;
    await snapModel.removeReaction(snapId, userId);
    res.json({ success: true, removed: true });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes author's own snap.
 */
const deleteSnap = async (req, res, next) => {
  try {
    const snapId = req.params.id;
    const authorId = req.user.id;
    const deleted = await snapModel.deleteSnap(snapId, authorId);
    if (!deleted) {
      return res.status(404).json({ error: "Snap not found or unauthorized" });
    }
    res.json({ message: "Snap deleted successfully", id: snapId });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSnap,
  getRail,
  getUserSnaps,
  getSnap,
  recordView,
  react,
  unreact,
  deleteSnap,
};
