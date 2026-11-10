const savedCollectionModel = require("../models/savedCollectionModel");

const list = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const collections = await savedCollectionModel.listCollections(userId);
    res.json(collections);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, is_private } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Collection name is required" });
    }
    const collection = await savedCollectionModel.createCollection(
      userId,
      name.trim(),
      is_private !== false
    );
    res.status(201).json(collection);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A collection with that name already exists" });
    }
    next(err);
  }
};

const addItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id: collectionId } = req.params;
    const { postId } = req.body;
    if (!postId) {
      return res.status(400).json({ error: "postId is required" });
    }
    const result = await savedCollectionModel.addItemToCollection(userId, collectionId, postId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const removeItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id: collectionId, postId } = req.params;
    const result = await savedCollectionModel.removeItemFromCollection(userId, collectionId, postId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id: collectionId } = req.params;
    const result = await savedCollectionModel.deleteCollection(userId, collectionId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  create,
  addItem,
  removeItem,
  remove,
};
