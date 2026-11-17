const postModel = require("../models/postModel");
const userModel = require("../models/userModel");
const { clampLimit } = require("../models/pagination");
const {
  parseSearch,
  parseUuidFilter,
  parseCategoryFilter,
  parseTextFilter,
} = require("../utils/queryFilters");

/**
 * Controller for unauthenticated / guest read-only public endpoints.
 * ZERO ORM: strictly uses parameterized raw SQL queries.
 * Strict read-only: no mutations, and hidden/moderated items are excluded.
 */

const getPosts = async (req, res, next) => {
  try {
    // Optional filters: ?q=<text>&author_id=<uuid>
    const author = parseUuidFilter(req.query.author_id, "author_id");
    if (author.error) {
      return res.status(400).json({ error: author.error });
    }

    const posts = await postModel.getAllPosts({
      limit: clampLimit(req.query.limit),
      cursor: req.query.cursor || null,
      q: parseSearch(req.query.q),
      authorId: author.value,
    });
    // Ensure hidden content is never leaked to public visitors
    const publicPosts = (posts || []).filter(
      (p) => p.moderation_status !== "hidden"
    );
    res.json(publicPosts);
  } catch (error) {
    next(error);
  }
};

const getPostById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await postModel.getPostById(id, { includeHidden: false });
    if (!post || post.moderation_status === "hidden") {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(post);
  } catch (error) {
    next(error);
  }
};

const getComments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await postModel.getPostById(id, { includeHidden: false });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comments = await postModel.getComments(id, { includeHidden: false });
    res.json(comments || []);
  } catch (error) {
    next(error);
  }
};

const getTheses = async (req, res, next) => {
  try {
    // Optional filters: ?q=<text>&uploader_id=<uuid>&category=<label>
    const uploader = parseUuidFilter(req.query.uploader_id, "uploader_id");
    if (uploader.error) {
      return res.status(400).json({ error: uploader.error });
    }

    const posts = await postModel.getAllPosts({
      limit: clampLimit(req.query.limit),
      cursor: req.query.cursor || null,
      q: parseSearch(req.query.q),
      authorId: uploader.value,
      kind: "repository",
      repository_type: "thesis",
      categories: parseCategoryFilter(req.query.category),
    });
    // Ensure hidden content is never leaked to public visitors
    const publicTheses = (posts || []).filter(
      (p) => p.moderation_status !== "hidden"
    );
    res.json(publicTheses);
  } catch (error) {
    next(error);
  }
};

const getThesisById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await postModel.getPostById(id, { includeHidden: false });
    if (!post || post.moderation_status === "hidden" || post.kind !== "repository" || post.repository_type !== "thesis") {
      return res.status(404).json({ error: "Thesis not found" });
    }
    res.json(post);
  } catch (error) {
    next(error);
  }
};

const getPeers = async (req, res, next) => {
  try {
    // Optional directory filters: ?q=<name>&department_id=<uuid>&year_level=<text>
    const department = parseUuidFilter(
      req.query.department_id,
      "department_id"
    );
    if (department.error) {
      return res.status(400).json({ error: department.error });
    }

    const users = await userModel.getAllUsers({
      limit: clampLimit(req.query.limit || 20),
      cursor: req.query.cursor || null,
      q: parseSearch(req.query.q),
      departmentId: department.value,
      yearLevel: parseTextFilter(req.query.year_level, 50),
    });
    // Public peers only need the fields the guest feed renders. Keep bio,
    // course, role, and department IDs behind authenticated endpoints.
    const publicPeers = (users || []).map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      avatar_url: u.avatar_url,
      year_level: u.year_level,
      department_name: u.department_name,
    }));
    res.json(publicPeers);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPosts,
  getPostById,
  getComments,
  getTheses,
  getThesisById,
  getPeers,
};
