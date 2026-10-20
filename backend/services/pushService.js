const db = require("../db");
const socialModel = require("../models/socialModel");

/**
 * OS push via the Expo Push Service (Messaging_plan.md §10, Phase 5).
 *
 * This is the **third** notification layer: the DB row is written atomically in
 * the send transaction (§11) and Realtime drives the in-app bell — push only
 * covers the "app backgrounded" case, so it is deliberately best-effort. It must
 * never throw into the request that triggered it, and never blocks a response.
 *
 * Policy honored here:
 *   * **DND** (`presence_mode = 'dnd'`) ⇒ push suppressed.
 *   * **Mute** (`conversation_state.muted_until > NOW()`) ⇒ push hidden, row kept.
 *   * **Message request** ⇒ quiet (no sound, normal priority).
 *   * Only a short preview is sent — never the full body (§13).
 *   * Tokens Expo reports as `DeviceNotRegistered` are pruned (§10).
 *
 * Delivery requires an EAS dev build with FCM/APNs credentials; without them the
 * Expo service returns an error ticket and the row simply stays in the app.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100; // Expo's per-request limit
const PREVIEW_LENGTH = 80;

const isDnd = (mode) => String(mode || "").toLowerCase() === "dnd";

const pushEnabled = () => String(process.env.PUSH_ENABLED || "true").toLowerCase() !== "false";

/**
 * Recipient's push preferences in one round-trip: presence mode (for DND) and
 * this conversation's mute window (when a conversation is supplied).
 */
const getPushPreferences = async (userId, conversationId = null) => {
  const result = await db.query(
    `SELECT p.presence_mode, cs.muted_until
       FROM public.profiles p
       LEFT JOIN public.conversation_state cs
         ON cs.user_id = p.id AND cs.conversation_id = $2
      WHERE p.id = $1;`,
    [userId, conversationId]
  );
  return result.rows[0] || null;
};

/**
 * Low-level Expo Push API call. Chunks at 100, prunes dead tokens, and swallows
 * every failure (a push outage must not affect messaging). Returns the ticket
 * array for observability/tests.
 */
const sendExpoPush = async (payloads, fetchImpl = globalThis.fetch) => {
  if (!payloads || payloads.length === 0) return [];
  const tickets = [];

  for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
    const chunk = payloads.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetchImpl(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        console.error(`[push] Expo responded ${res.status}`);
        continue;
      }

      const json = await res.json();
      const data = Array.isArray(json?.data) ? json.data : [];
      tickets.push(...data);

      // Prune tokens Expo says are dead — keeps the table from growing forever.
      const dead = [];
      data.forEach((ticket, index) => {
        if (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered") {
          const token = chunk[index]?.to;
          if (token) dead.push(token);
        }
      });
      if (dead.length > 0) await socialModel.deleteDeviceTokens(dead);
    } catch (err) {
      console.error("[push] Expo request failed:", err.message);
    }
  }

  return tickets;
};

/**
 * Core: resolves a user's tokens and pushes one payload to each device.
 * `quiet` drops the sound and lowers priority; `conversationId` enables the mute
 * check. Returns the tickets sent (empty when suppressed or unconfigured).
 */
const sendToUser = async (
  { userId, title, body, data = {}, quiet = false, conversationId = null, respectDnd = true },
  { fetchImpl = globalThis.fetch } = {}
) => {
  if (!pushEnabled()) return [];
  try {
    const prefs = await getPushPreferences(userId, conversationId);
    if (!prefs) return [];
    if (respectDnd && isDnd(prefs.presence_mode)) return [];
    if (
      conversationId &&
      prefs.muted_until &&
      new Date(prefs.muted_until).getTime() > Date.now()
    ) {
      return [];
    }

    const tokens = await socialModel.listDeviceTokens(userId);
    if (tokens.length === 0) return [];

    const payloads = tokens.map(({ token }) => ({
      to: token,
      sound: quiet ? null : "default",
      title,
      body,
      data,
      priority: quiet ? "normal" : "high",
    }));

    return await sendExpoPush(payloads, fetchImpl);
  } catch (err) {
    console.error("[push] sendToUser failed:", err.message);
    return [];
  }
};

/** New-message push. Requests are quiet; DND/mute suppress (§10). */
const notifyNewMessage = (
  { recipientId, senderId, senderName, body, conversationId, isRequest = false },
  opts = {}
) => {
  const preview = String(body || "").replace(/\s+/g, " ").trim().slice(0, PREVIEW_LENGTH);
  return sendToUser(
    {
      userId: recipientId,
      title: isRequest ? "New message request" : senderName,
      body: isRequest ? `${senderName} sent you a message request.` : preview,
      data: {
        type: isRequest ? "message_request" : "new_message",
        conversationId,
        actorId: senderId,
      },
      quiet: isRequest,
      conversationId,
    },
    opts
  );
};

/** Friend request/accept push. Requests are quiet; DND suppresses (§10). */
const notifyFriendEvent = ({ recipientId, actorId, actorName, type }, opts = {}) => {
  const accepted = type === "friend_accepted";
  return sendToUser(
    {
      userId: recipientId,
      title: accepted ? "Friend request accepted" : "New friend request",
      body: accepted
        ? `${actorName} accepted your friend request.`
        : `${actorName} sent you a friend request.`,
      data: { type, actorId },
      quiet: !accepted,
    },
    opts
  );
};

module.exports = {
  sendExpoPush,
  sendToUser,
  notifyNewMessage,
  notifyFriendEvent,
  getPushPreferences,
  pushEnabled,
};
