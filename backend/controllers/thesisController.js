const thesisModel = require("../models/thesisModel");
const { clampLimit } = require("../models/pagination");
const {
  parseSearch,
  parseUuidFilter,
  parseCategoryFilter,
} = require("../utils/queryFilters");
const moderationService = require("../services/moderationService");
const notificationService = require("../services/notificationService");

const getTheses = async (req, res, next) => {
  try {
    // Optional filters: ?q=<text>&uploader_id=<uuid>&category=<label>
    // plus keyset pagination: ?limit=<1..100>&cursor=<created_at>|<id>
    const uploader = parseUuidFilter(req.query.uploader_id, "uploader_id");
    if (uploader.error) {
      return res.status(400).json({ error: uploader.error });
    }

    const theses = await thesisModel.getAllTheses({
      limit: clampLimit(req.query.limit),
      cursor: req.query.cursor || null,
      q: parseSearch(req.query.q),
      uploaderId: uploader.value,
      categories: parseCategoryFilter(req.query.category),
    });
    res.json(theses);
  } catch (error) {
    next(error);
  }
};

const getThesis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const thesis = await thesisModel.getThesisById(id);
    if (!thesis) {
      return res.status(404).json({ message: "Thesis not found" });
    }
    res.json(thesis);
  } catch (error) {
    next(error);
  }
};

const createThesis = async (req, res, next) => {
  try {
    // Department is derived server-side from the uploader's profile — never a
    // client-supplied value — so moderation/notification scope can't be spoofed.
    const newThesis = await thesisModel.createThesis({
      ...req.body,
      uploader_id: req.user.id,
      department_id: req.profile?.department_id || null,
      department: req.profile?.department_name || null,
      moderation_status: "approved",
    });
    res.status(201).json(newThesis);

    // Asynchronously notify department and campus admins
    Promise.resolve().then(async () => {
      try {
        await notificationService.notifyAdminsOnThesisCreated(newThesis, req.profile);
        const scan = await moderationService.scanThesis(newThesis);
        if (scan && scan.flagged) {
          await notificationService.notifyAdminsOnFlaggedContent({
            targetId: newThesis.id,
            type: "thesis",
            reason: scan.reason,
            departmentId: newThesis.department_id || req.profile?.department_id,
            departmentName: req.profile?.department_name || newThesis.department,
            authorId: req.user.id,
            snippet: newThesis.title.slice(0, 80),
          });
        }
      } catch (scanErr) {
        console.error("[moderation] Thesis scan failed:", scanErr);
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateThesis = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Ownership is enforced in SQL (uploader_id = caller).
    const updated = await thesisModel.updateThesis(id, req.user.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Thesis not found" });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const deleteThesis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await thesisModel.deleteThesis(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ message: "Thesis not found" });
    }
    res.json({ message: "Thesis deleted successfully", thesis: deleted });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTheses,
  getThesis,
  createThesis,
  updateThesis,
  deleteThesis,
};
