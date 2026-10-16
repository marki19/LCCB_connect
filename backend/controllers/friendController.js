const friendModel = require("../models/friendModel");
const socialModel = require("../models/socialModel");
const notificationService = require("../services/notificationService");
const { clampLimit } = require("../models/pagination");

/**
 * Friends (Messaging_plan.md §5). Mutual request → accept/decline; an accepted
 * friendship bypasses the recipient's message policy (§4).
 */

const GENERIC_BLOCK = { error: "This user isn't accepting messages" };

const displayName = (profile) =>
  profile?.full_name || profile?.username || "Someone";

const listFriends = async (req, res, next) => {
  try {
    res.json(await friendModel.listFriends(req.user.id, { limit: clampLimit(req.query.limit) }));
  } catch (error) {
    next(error);
  }
};

const getRequests = async (req, res, next) => {
  try {
    const limit = clampLimit(req.query.limit);
    const [incoming, outgoing] = await Promise.all([
      friendModel.listIncomingRequests(req.user.id, { limit }),
      friendModel.listOutgoingRequests(req.user.id, { limit }),
    ]);
    res.json({ incoming, outgoing });
  } catch (error) {
    next(error);
  }
};

/** Anyone may request, but a blocked pair cannot (§5). Rate-limited. */
const createRequest = async (req, res, next) => {
  try {
    const { addressee_id } = req.body;
    if (addressee_id === req.user.id) {
      return res.status(400).json({ error: "You can't add yourself" });
    }

    // Block wins over everything, and is checked in both directions.
    const blocked =
      (await socialModel.isBlocked(req.user.id, addressee_id)) ||
      (await socialModel.isBlocked(addressee_id, req.user.id));
    if (blocked) {
      return res.status(403).json(GENERIC_BLOCK);
    }

    const existing = await friendModel.getPair(req.user.id, addressee_id);
    if (existing && existing.status === "accepted") {
      return res.status(409).json({ error: "You're already friends" });
    }
    if (existing && existing.status === "pending") {
      return res.status(409).json({ error: "A request is already pending" });
    }

    const created = await friendModel.upsertRequest(req.user.id, addressee_id);
    res.status(201).json(created);

    Promise.resolve()
      .then(() =>
        notificationService.notifyUser({
          userId: addressee_id,
          actorId: req.user.id,
          type: "friend_request",
          targetId: created.id,
          message: `${displayName(req.profile)} sent you a friend request.`,
        })
      )
      .catch((err) => console.error("[friends] request notification failed:", err));
  } catch (error) {
    next(error);
  }
};

const respond = (status) => async (req, res, next) => {
  try {
    const friendship = await friendModel.respond(req.params.id, req.user.id, status);
    if (!friendship) {
      return res.status(404).json({ error: "Request not found" });
    }
    res.json(friendship);

    if (status === "accepted") {
      Promise.resolve()
        .then(() =>
          notificationService.notifyUser({
            userId: friendship.requester_id,
            actorId: req.user.id,
            type: "friend_accepted",
            targetId: friendship.id,
            message: `${displayName(req.profile)} accepted your friend request.`,
          })
        )
        .catch((err) => console.error("[friends] accept notification failed:", err));
    }
  } catch (error) {
    next(error);
  }
};

/** Unfriend, or cancel a request you sent — either direction. */
const removeFriend = async (req, res, next) => {
  try {
    const removed = await friendModel.removePair(req.user.id, req.params.userId);
    if (!removed) {
      return res.status(404).json({ error: "No friendship with that user" });
    }
    res.json({ message: "Removed", friendship: removed });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listFriends,
  getRequests,
  createRequest,
  acceptRequest: respond("accepted"),
  declineRequest: respond("declined"),
  removeFriend,
};
