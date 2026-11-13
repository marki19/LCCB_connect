const multer = require("multer");
const { CATEGORIES, CATEGORY_RULES } = require("../services/localStorage");

const storage = multer.memoryStorage();

// Maximum ceiling across all categories is 50 MB
const MAX_GLOBAL_BYTES = 50 * 1024 * 1024;

const fileFilter = (req, file, cb) => {
  const category = (req.params.category || "").toLowerCase();

  if (!CATEGORIES.includes(category)) {
    return cb(new Error(`Invalid upload category: ${category}`), false);
  }

  const rules = CATEGORY_RULES[category];
  const fileMime = (file.mimetype || "").toLowerCase();

  if (!rules.allowedMimes.includes(fileMime)) {
    return cb(
      new Error(
        `File type "${fileMime}" is not permitted for category "${category}"`
      ),
      false
    );
  }

  cb(null, true);
};

const localUpload = multer({
  storage,
  limits: {
    fileSize: MAX_GLOBAL_BYTES,
    files: 1,
  },
  fileFilter,
});

module.exports = {
  localUpload,
};

