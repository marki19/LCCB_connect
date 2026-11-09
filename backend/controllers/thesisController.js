const thesisModel = require("../models/thesisModel");
const { clampLimit } = require("../models/pagination");
const {
  parseSearch,
  parseUuidFilter,
  parseCategoryFilter,
} = require("../utils/queryFilters");
const moderationService = require("../services/moderationService");
const notificationService = require("../services/notificationService");
const { resolveAudience } = require("../services/visibilityService");
const { assertPdfMagic } = require("../middleware/upload");
const { deleteStorageObject } = require("../services/storageCleanup");
const { getSupabaseAdmin } = require("../services/supabaseAdmin");

/**
 * A custom-visibility write must name accepted friends. Returns the normalized
 * audience, or a `{ error, invalid }` payload the controller returns as 400.
 */
const resolveRequestBodyAudience = async (uploaderId, body) => {
  if (body.audience === undefined && body.visibility !== "custom") {
    return { body };
  }
  const resolved = await resolveAudience(uploaderId, body.audience ?? []);
  if (resolved.error) return { error: resolved.error, invalid: resolved.invalid };
  return { body: { ...body, audience: resolved.audience } };
};

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
      viewerId: req.user?.id || null,
    });
    res.json(theses);
  } catch (error) {
    next(error);
  }
};

const getThesis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const thesis = await thesisModel.getThesisById(id, {
      viewerId: req.user?.id || null,
    });
    if (!thesis) {
      return res.status(404).json({ message: "Thesis not found" });
    }
    res.json(thesis);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/theses — deposit a new manuscript.
 *
 * The `upload.single("pdf")` middleware is applied by the router (see
 * thesisRouter.js), so this handler receives `req.file` already parsed. It
 * accepts multipart/form-data with a `pdf` file field (required) and the usual
 * text fields (title, abstract, category, visibility, audience). The PDF is
 * validated for magic bytes and size, then uploaded to Supabase Storage as
 * `theses/<uid>/<timestamp>.pdf`. The API stores only the object key, never
 * the full URL.
 */
const createThesis = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "PDF manuscript is required" });
    }

    // Validate magic bytes
    try {
      assertPdfMagic(req.file.buffer);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    // Extract text fields from req.body (multer parses form fields)
    const {
      title,
      abstract,
      category,
      visibility = "public",
      audience,
    } = req.body;

    // Build the storage path
    const path = `theses/${req.user.id}/${Date.now()}.pdf`;

    // Upload via service-role key (never exposed to the client)
    const supabase = getSupabaseAdmin();
    const { error: uploadError } = await supabase.storage
      .from("theses")
      .upload(path, req.file.buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Persist the thesis row with the storage key only
    const newThesis = await thesisModel.createThesis({
      uploader_id: req.user.id,
      title: title || "Untitled",
      abstract: abstract || "",
      department_id: req.profile?.department_id || null,
      department: req.profile?.department_name || null,
      category: category || "Undergraduate Capstone",
      pdf_url: path,
      visibility,
      audience,
      moderation_status: "approved",
    });

    // Notify admins asynchronously
    // Fire-and-forget: moderation runs after the response is sent, so a slow
    // scan or a notification failure never delays the deposit.
    setImmediate(() => {
      Promise.resolve()
        .then(() => notificationService.notifyAdminsOnThesisCreated(newThesis, req.profile))
        .then(() => moderationService.scanThesis(newThesis))
        .then((scan) => {
          if (scan && scan.flagged) {
            return notificationService.notifyAdminsOnFlaggedContent({
              targetId: newThesis.id,
              type: "thesis",
              reason: scan.reason,
              departmentId: newThesis.department_id || req.profile?.department_id,
              departmentName: newThesis.department || req.profile?.department_name,
              authorId: req.user.id,
              snippet: newThesis.title.slice(0, 80),
            });
          }
        })
        .catch((scanErr) => {
          console.error("[moderation] Thesis scan failed:", scanErr);
        });
    });

    res.status(201).json(newThesis);
  } catch (error) {
    next(error);
  }
};

const updateThesis = async (req, res, next) => {
  try {
    const { id } = req.params;

    // If a new manuscript was uploaded alongside the edit, upload it first and
    // point the row at the new key. The old file is cleaned up best-effort.
    let pdfUrl;
    if (req.file) {
      try {
        assertPdfMagic(req.file.buffer);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }

      // Remove the old file before storing the new one (best-effort).
      const oldKey = await thesisModel.getThesisFileKey(id);
      const path = `theses/${req.user.id}/${Date.now()}.pdf`;

      const supabase = getSupabaseAdmin();
      const { error: uploadError } = await supabase.storage
        .from("theses")
        .upload(path, req.file.buffer, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      deleteStorageObject("theses", oldKey).catch((err) => {
        console.error("[cleanup] failed to remove old thesis PDF:", err);
      });
      pdfUrl = path;
    }

    // Allow partial updates. `pdf_url` is never accepted from the JSON body —
    // PDFs only arrive through the multipart field above.
    const {
      title,
      abstract,
      category,
      visibility,
      audience,
    } = req.body;

    // Ownership is enforced in SQL (uploader_id = caller).
    const updated = await thesisModel.updateThesis(id, req.user.id, {
      title,
      abstract,
      category,
      visibility,
      audience,
      ...(pdfUrl ? { pdf_url: pdfUrl } : {}),
    });
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

    // First, fetch the PDF key so we can try to delete it from Storage.
    const pdfKey = await thesisModel.getThesisFileKey(id);

    // Delete the row (owner check is in the model).
    const deleted = await thesisModel.deleteThesis(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ message: "Thesis not found" });
    }

    // Best-effort cleanup of the Storage object. Never fail the delete if
    // the Storage operation fails — the row is already gone.
    deleteStorageObject("theses", pdfKey).catch((err) => {
      console.error("[cleanup] failed to remove thesis PDF from storage:", err);
    });

    res.json({ message: "Thesis deleted successfully", thesis: deleted });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/theses/:id/file — signed URL for the manuscript PDF.
 *
 * Returns a signed URL that the front-end can use to open the PDF. The URL
 * expires after 5 minutes. Only the owner, visible viewers, or a moderator
 * can access this endpoint.
 */
const getThesisFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const viewerId = req.user?.id || null;

    // Visibility is enforced by the model's use of visible_theses().
    const thesis = await thesisModel.getThesisById(id, { viewerId });
    if (!thesis) {
      return res.status(404).json({ message: "Thesis not found" });
    }

    if (!thesis.pdf_url) {
      return res.status(404).json({ message: "Thesis has no uploaded manuscript" });
    }

    // Issue a signed URL for the private thesis bucket.
    const { signedStorageUrl } = require("../services/storageService");
    const { url } = await signedStorageUrl("theses", thesis.pdf_url, { expiresIn: 300 });

    if (!url) {
      return res.status(404).json({ message: "Could not generate file URL" });
    }

    res.json({ url });
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
  getThesisFile,
};