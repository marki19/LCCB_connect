const socialModel = require("../models/socialModel");

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

const blockUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "You can't block yourself" });
    }
    const block = await socialModel.block(req.user.id, req.params.id);
    res.status(201).json(block);
  } catch (error) {
    next(error);
  }
};

const unblockUser = async (req, res, next) => {
  try {
    const removed = await socialModel.unblock(req.user.id, req.params.id);
    res.json({ unblocked: Boolean(removed) });
  } catch (error) {
    next(error);
  }
};

const listBlocked = async (req, res, next) => {
  try {
    res.json(await socialModel.listBlocked(req.user.id));
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
};
