const { withStorageUrls } = require("../services/storageService");

/**
 * Converts file columns from their stored storage keys to the public URLs the
 * UI renders. Keeping this at the response boundary means controllers/models
 * stay focused on data and don't have to know where objects live.
 */
function attachStorageUrls(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(withStorageUrls(body));
  next();
}

module.exports = attachStorageUrls;
