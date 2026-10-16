const messageModel = require("../models/messageModel");
const notificationService = require("../services/notificationService");
const pushService = require("../services/pushService");
const { clampLimit } = require("../models/pagination");

/**
 * Messaging controller (Messaging_plan.md §6, §9, §11).
 *
 * Authorization rules enforced here:
 *   * identity is `req.user.id` only — never a body field;
 *   * a non-participant gets **404** (never 403), so conversation ids can't be
 *     probed;
 *   * a blocked send returns a **generic** 403 (block vs policy is never
 *     disclosed).
 */

const GENERIC_BLOCK = { error: "This user isn't accepting messages" };

const parseSeq = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/** 404s unless the caller is a participant of the conversation. */
const loadParticipantConversation = async (req, res) => {
  const conversation = await messageModel.getConversationForParticipant(
    req.params.id,
    req.user.id
  );
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return null;
  }
  return conversation;
};

// ---- conversations ---------------------------------------------------------

const getConversations = async (req, res, next) => {
  try {
    const list = await messageModel.listConversations(req.user.id, {
      limit: clampLimit(req.query.limit),
    });
    res.json(list);
  } catch (error) {
    next(error);
  }
};

const getRequests = async (req, res, next) => {
  try {
    const requests = await messageModel.listRequests(req.user.id, {
      limit: clampLimit(req.query.limit),
    });
    res.json(requests);
  } catch (error) {
    next(error);
  }
};

/**
 * Opens (or re-opens) the 1:1 thread with `peer_id`. The permission engine
 * decides whether it starts `active` (direct) or `requested`.
 */
const createConversation = async (req, res, next) => {
  try {
    const { peer_id } = req.body;
    if (peer_id === req.user.id) {
      return res.status(400).json({ error: "You can't message yourself" });
    }

    const decision = await messageModel.canMessage(req.user.id, peer_id);
    if (decision === null) {
      return res.status(404).json({ error: "User not found" });
    }
    if (decision === "blocked") {
      return res.status(403).json(GENERIC_BLOCK);
    }

    const status = decision === "direct" ? "active" : "requested";
    const conversation = await messageModel.getOrCreateConversation(
      req.user.id,
      peer_id,
      status
    );
    res.status(201).json(conversation);
  } catch (error) {
    next(error);
  }
};

/** Only the addressee can accept a request (§6). */
const acceptRequest = async (req, res, next) => {
  try {
    const conversation = await messageModel.acceptRequest(req.params.id, req.user.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.json(conversation);

    // Tell the requester their request was accepted (quiet, best-effort).
    const requesterId = conversation.requester_id;
    if (requesterId) {
      Promise.resolve()
        .then(() =>
          notificationService.notifyUser({
            userId: requesterId,
            actorId: req.user.id,
            type: "new_message",
            targetId: conversation.id,
            message: "Your message request was accepted.",
          })
        )
        .catch((err) => console.error("[messaging] accept notification failed:", err));
    }
  } catch (error) {
    next(error);
  }
};

// ---- messages --------------------------------------------------------------

const getMessages = async (req, res, next) => {
  try {
    const conversation = await loadParticipantConversation(req, res);
    if (!conversation) return;

    const messages = await messageModel.listMessages(conversation.id, {
      limit: clampLimit(req.query.limit),
      // `since_seq` = catch-up (everything after a seq). `cursor` (the plan's
      // name; `before_seq` also accepted) = paginate backwards through history.
      sinceSeq: parseSeq(req.query.since_seq),
      beforeSeq: parseSeq(req.query.before_seq ?? req.query.cursor),
    });
    res.json(messages);
  } catch (error) {
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const senderName =
      req.profile?.full_name || req.profile?.username || "Someone";

    const result = await messageModel.sendMessage({
      conversationId: req.params.id,
      senderId: req.user.id,
      body: req.body.body,
      clientMsgId: req.body.client_msg_id,
      senderName,
    });

    res.status(result.deduped ? 200 : 201).json(result.message);

    // OS push (§10) — third layer, best-effort, never blocks the response. A
    // deduped retry already pushed on its first attempt, so don't push twice.
    if (!result.deduped) {
      Promise.resolve()
        .then(() =>
          pushService.notifyNewMessage({
            recipientId: result.message.recipient_id,
            senderId: req.user.id,
            senderName,
            body: req.body.body,
            conversationId: result.message.conversation_id,
            isRequest: result.status === "requested",
          })
        )
        .catch((err) => console.error("[messaging] push failed:", err));
    }
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const conversation = await loadParticipantConversation(req, res);
    if (!conversation) return;

    const result = await messageModel.markRead(
      conversation.id,
      req.user.id,
      req.body.upto_seq
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const muteConversation = async (req, res, next) => {
  try {
    const conversation = await loadParticipantConversation(req, res);
    if (!conversation) return;

    const state = await messageModel.muteConversation(
      conversation.id,
      req.user.id,
      req.body.mute_minutes
    );
    res.json(state);
  } catch (error) {
    next(error);
  }
};

/** Delivery ack — recipient-only; a non-recipient sees the same 404 as missing. */
const markDelivered = async (req, res, next) => {
  try {
    const message = await messageModel.markDelivered(req.params.id, req.user.id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json(message);
  } catch (error) {
    next(error);
  }
};

/** Report a message → moderation queue. Only a participant of the thread. */
const reportMessage = async (req, res, next) => {
  try {
    const message = await messageModel.getMessageById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    const participant = await messageModel.getConversationForParticipant(
      message.conversation_id,
      req.user.id
    );
    if (!participant) {
      return res.status(404).json({ error: "Message not found" });
    }

    const report = await messageModel.reportMessage(
      message.id,
      req.user.id,
      req.body.reason || null
    );
    res.status(201).json(report || { message_id: message.id, status: "open" });

    // Alert campus admins (best-effort; the report row is the durable record).
    Promise.resolve()
      .then(async () => {
        const admins = await notificationService.getTargetAdmins(null);
        await notificationService.createNotifications(
          admins.map((a) => a.id),
          {
            actorId: req.user.id,
            type: "flagged_message",
            targetId: message.conversation_id,
            message: "A message was reported for review.",
          }
        );
      })
      .catch((err) => console.error("[messaging] report notification failed:", err));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  getRequests,
  createConversation,
  acceptRequest,
  getMessages,
  sendMessage,
  markRead,
  muteConversation,
  markDelivered,
  reportMessage,
};
