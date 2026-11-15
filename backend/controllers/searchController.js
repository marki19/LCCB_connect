const searchModel = require("../models/searchModel");
const { clampLimit } = require("../models/pagination");

/**
 * Search Controller
 * Handles unified search across People, Posts, and Theses.
 */

const search = async (req, res, next) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : "";
    const type = req.query.type || "all";
    const limit = clampLimit(req.query.limit);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const viewerId = req.user?.id || null;

    if (!q) {
      return res.json({
        query: "",
        people: [],
        posts: [],
        theses: [],
        counts: { people: 0, posts: 0, theses: 0, total: 0 },
      });
    }

    if (type === "people") {
      const results = await searchModel.searchPeople(q, viewerId, { limit, offset });
      return res.json({ query: q, type: "people", people: results, count: results.length });
    }

    if (type === "posts") {
      const results = await searchModel.searchPosts(q, viewerId, { limit, offset });
      return res.json({ query: q, type: "posts", posts: results, count: results.length });
    }

    if (type === "theses" || type === "papers") {
      const results = await searchModel.searchTheses(q, viewerId, { limit, offset });
      return res.json({ query: q, type: "theses", theses: results, count: results.length });
    }

    // Default: 'all'
    const results = await searchModel.searchAll(q, viewerId, { limit });
    res.json(results);
  } catch (error) {
    next(error);
  }
};

const suggestions = async (req, res, next) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : "";
    const viewerId = req.user?.id || null;
    const limit = Math.min(10, Math.max(1, parseInt(req.query.limit, 10) || 6));

    const results = await searchModel.searchSuggestions(q, viewerId, { limit });
    res.json(results);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  search,
  suggestions,
};

