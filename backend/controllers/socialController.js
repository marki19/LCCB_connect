const socialModel = require("../models/socialModel");
const blockModel = require("../models/blockModel");
const { clampLimit } = require("../models/pagination");

/**
 * Social settings controller (Messaging_plan.md §4, §5, §7, §8):
 * "who can message me" policy, presence/heartbeat, device tokens, and blocks.
 */

// ---- message policy (§4) ---------------------------------------------------

const getMessagePolicy = async (req, res, next) => {
  try {
    const policy = await socialModel.getMessagePolicy(req.user.id);
    res.json(policy || { message_policy: "department", department_ids: [] });
  } catch (error) {
    next(error);
  }
};

const setMessagePolicy = async (req, res, next) => {
  try {
    const policy = await socialModel.setMessagePolicy(
      req.user.id,
      req.body.message_policy,
      // Only meaningful for `selected`; other policies ignore the list.
      req.body.message_policy === "selected" ? req.body.department_ids || [] : undefined
    );
    res.json(policy || { message_policy: req.body.message_policy, department_ids: [] });
  } catch (error) {
    next(error);
  }
};

// ---- presence (§8) ---------------------------------------------------------

const setPresence = async (req, res, next) => {
  try {
    res.json(await socialModel.setPresenceMode(req.user.id, req.body.mode));
  } catch (error) {
    next(error);
  }
};

const heartbeat = async (req, res, next) => {
  try {
    res.json(
      await socialModel.heartbeat(req.user.id, {
        mode: req.body.mode ?? null,
        lastSeenVisible: req.body.last_seen_visible ?? null,
      })
    );
  } catch (error) {
    next(error);
  }
};

// ---- device tokens (§7) ----------------------------------------------------

const addDeviceToken = async (req, res, next) => {
  try {
    const token = await socialModel.addDeviceToken(
      req.user.id,
      req.body.token,
      req.body.platform
    );
    res.status(201).json(token);
  } catch (error) {
    next(error);
  }
};

const removeDeviceToken = async (req, res, next) => {
  try {
    const removed = await socialModel.removeDeviceToken(req.user.id, req.body.token);
    res.json({ removed: Boolean(removed) });
  } catch (error) {
    next(error);
  }
};

// ---- blocks (§7) -----------------------------------------------------------
// One block implementation. `blockModel` owns the write path (bidirectional,
// with the ALREADY_BLOCKED / CANNOT_BLOCK_SELF codes the client already
// handles); `socialModel.isBlocked` stays because the messaging and friend
// request paths depend on it.

const blockUser = async (req, res, next) => {
  try {
    const block = await blockModel.blockUser(req.user.id, req.params.id);
    res.status(201).json(block);
  } catch (error) {
    if (error.code === "CANNOT_BLOCK_SELF") {
      return res.status(400).json({ error: error.message });
    }
    if (error.code === "ALREADY_BLOCKED") {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
};

const unblockUser = async (req, res, next) => {
  try {
    const block = await blockModel.unblockUser(req.user.id, req.params.id);
    if (!block) {
      return res.status(404).json({ message: "Block not found" });
    }
    res.json({ unblocked: true, block });
  } catch (error) {
    next(error);
  }
};

const listBlocked = async (req, res, next) => {
  try {
    const blocked = await blockModel.listBlocked(req.user.id, {
      limit: clampLimit(req.query.limit),
      cursor: req.query.cursor || null,
    });
    res.json(blocked);
  } catch (error) {
    next(error);
  }
};

// ---- profile banner --------------------------------------------------------

const dismissBanner = async (req, res, next) => {
  try {
    const dismissed = await socialModel.dismissProfileBanner(req.user.id);
    res.json({ profile_banner_dismissed: dismissed });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMessagePolicy,
  setMessagePolicy,
  setPresence,
  heartbeat,
  addDeviceToken,
  removeDeviceToken,
  blockUser,
  unblockUser,
  listBlocked,
  dismissBanner,
};
