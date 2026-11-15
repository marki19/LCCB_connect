const savedPostModel = require("../models/savedPostModel");
const { clampLimit } = require("../models/pagination");

/**
 * Controller for Saved Posts
 */

const save = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await savedPostModel.savePost(userId, id);
    res.status(200).json(result);
  } catch (error) {
    if (error.code === "POST_NOT_FOUND") {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};

const unsave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await savedPostModel.unsavePost(userId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const list = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = clampLimit(req.query.limit);
    const cursor = req.query.cursor || null;

    const result = await savedPostModel.listSavedPosts(userId, { limit, cursor });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  save,
  unsave,
  list,
};

