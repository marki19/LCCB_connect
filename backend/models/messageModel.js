const db = require("../db");
const notificationService = require("../services/notificationService");
const { DEFAULT_LIMIT } = require("./pagination");

/**
 * Messaging data layer (Messaging_plan.md §4, §6, §7, §9, §11).
 *
 * Everything here is raw SQL. Writes never come from the client: the sender and
 * recipient are derived from the conversation row joined to the verified token,
 * so a caller cannot post as someone else (§11 Rules).
 *
 * Errors that should surface as HTTP statuses carry `.status`; the centralized
 * error handler turns `err.message` into the response for < 500 statuses.
 */

const blockedError = () => {
  const err = new Error("This user isn't accepting messages");
  err.status = 403;
  return err;
};

const notFoundError = () => {
  const err = new Error("Conversation not found");
  err.status = 404;
  return err;
};

// ---------------------------------------------------------------------------
// Permission engine (§4)
// ---------------------------------------------------------------------------

/**
 * Decides whether `senderId` may open a thread with `recipientId`, from one
 * round-trip (CTE) of relationship facts. Returns:
 *   'direct'  → conversation is created `active`
 *   'request' → conversation is created `requested` (§6)
 *   'blocked' → refuse with a generic message (never reveal block vs policy)
 *   null      → sender or recipient profile does not exist
 *
 * `runner` lets the send path evaluate this inside its own transaction.
 */
const canMessage = async (senderId, recipientId, runner = db) => {
  const sql = `
    WITH s AS (SELECT department_id FROM public.profiles WHERE id = $1),
         r AS (SELECT department_id, message_policy FROM public.profiles WHERE id = $2)
    SELECT
      EXISTS (SELECT 1 FROM s)                  AS sender_exists,
      EXISTS (SELECT 1 FROM r)                  AS recipient_exists,
      (SELECT department_id FROM s)             AS sender_department_id,
      (SELECT department_id FROM r)             AS recipient_department_id,
      (SELECT message_policy FROM r)            AS recipient_policy,
      EXISTS (SELECT 1 FROM public.blocks b
              WHERE (b.blocker_id = $1 AND b.blocked_id = $2)
                 OR (b.blocker_id = $2 AND b.blocked_id = $1)) AS is_blocked,
      EXISTS (SELECT 1 FROM public.friendships f
              WHERE f.status = 'accepted'
                AND ((f.requester_id = $1 AND f.addressee_id = $2)
                  OR (f.requester_id = $2 AND f.addressee_id = $1))) AS is_friend,
      EXISTS (SELECT 1 FROM public.message_policy_departments p
              WHERE p.user_id = $2
                AND p.department_id = (SELECT department_id FROM s)) AS sender_department_allowed
  `;
  const { rows } = await runner.query(sql, [senderId, recipientId]);
  const row = rows[0];
  // A SELECT without FROM always yields one row; missing profiles surface as
  // null existence flags rather than an absent row.
  if (!row || !row.sender_exists || !row.recipient_exists) return null;
  return resolveDecision(row);
};

/**
 * The §4 decision table, isolated from I/O so it can be reasoned about and
 * tested on its own.
 *
 * Order of precedence: block (hard stop) → accepted friend (bypass) → recipient
 * policy. `department` fails closed when either side has no department on file.
 */
const resolveDecision = (row) => {
  if (row.is_blocked) return "blocked";
  if (row.is_friend) return "direct";

  switch (row.recipient_policy) {
    case "everyone":
      return "direct";
    case "department":
      return row.sender_department_id &&
        row.recipient_department_id &&
        row.sender_department_id === row.recipient_department_id
        ? "direct"
        : "request";
    case "selected":
      return row.sender_department_allowed ? "direct" : "request";
    case "nobody":
    default:
      // Fail safe: an absent/unknown policy is treated as the most restrictive
      // non-blocked outcome, never as permission.
      return "request";
  }
};

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

/** The pair is stored normalized (`user_a < user_b`), matching the unique key. */
const getOrCreateConversation = async (senderId, peerId, status) => {
  const requesterId = status === "requested" ? senderId : null;
  const sql = `
    WITH ins AS (
      INSERT INTO public.conversations (user_a, user_b, requester_id, status)
      VALUES (LEAST($1, $2), GREATEST($1, $2), $3, $4)
      ON CONFLICT (user_a, user_b) DO NOTHING
      RETURNING *
    )
    SELECT * FROM ins
    UNION ALL
    SELECT * FROM public.conversations
      WHERE user_a = LEAST($1, $2) AND user_b = GREATEST($1, $2)
    LIMIT 1;
  `;
  const result = await db.query(sql, [senderId, peerId, requesterId, status]);
  return result.rows[0];
};

/** Participant-scoped lookup — anything else must look like a 404, not a 403. */
const getConversationForParticipant = async (id, userId) => {
  const result = await db.query(
    `SELECT * FROM public.conversations
      WHERE id = $1 AND (user_a = $2 OR user_b = $2);`,
    [id, userId]
  );
  return result.rows[0];
};

const PEER_JOIN = `
  LEFT JOIN public.profiles pr
    ON pr.id = CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END
  LEFT JOIN public.departments d ON d.id = pr.department_id
`;

const CONVERSATION_SELECT = `
  c.id, c.status, c.requester_id, c.last_message_at, c.created_at,
  c.user_a, c.user_b,
  json_build_object(
    'id', pr.id,
    'username', pr.username,
    'full_name', pr.full_name,
    'avatar_url', pr.avatar_url,
    'department_id', pr.department_id,
    'department_name', d.name
  ) AS peer,
  (SELECT json_build_object(
      'id', m.id, 'body', m.body, 'sender_id', m.sender_id,
      'seq', m.seq, 'created_at', m.created_at)
     FROM public.messages m WHERE m.conversation_id = c.id
     ORDER BY m.seq DESC LIMIT 1) AS last_message,
  (SELECT COUNT(*)::int FROM public.messages m
     WHERE m.conversation_id = c.id AND m.recipient_id = $1 AND m.read_at IS NULL) AS unread
`;

/** Main inbox: `active` threads the caller participates in, newest activity first. */
const listConversations = async (userId, { limit = DEFAULT_LIMIT } = {}) => {
  const sql = `
    SELECT ${CONVERSATION_SELECT}
    FROM public.conversations c
    ${PEER_JOIN}
    LEFT JOIN public.conversation_state cs
      ON cs.conversation_id = c.id AND cs.user_id = $1
    WHERE (c.user_a = $1 OR c.user_b = $1) AND c.status = 'active'
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
    LIMIT $2;
  `;
  const result = await db.query(sql, [userId, limit]);
  return result.rows;
};

/** Requests inbox (§6): received (I am the addressee) and sent (I am the requester). */
const listRequests = async (userId, { limit = DEFAULT_LIMIT } = {}) => {
  const sql = `
    SELECT ${CONVERSATION_SELECT}, c.requester_id
    FROM public.conversations c
    ${PEER_JOIN}
    WHERE c.status = 'requested' AND (c.user_a = $1 OR c.user_b = $1)
    ORDER BY c.created_at DESC
    LIMIT $2;
  `;
  const result = await db.query(sql, [userId, limit]);
  const received = [];
  const sent = [];
  for (const row of result.rows) {
    (row.requester_id === userId ? sent : received).push(row);
  }
  return { received, sent };
};

/**
 * Accepts a request. Only the addressee (participant who is not the requester)
 * may accept; anyone else gets `undefined` → 404. Returns the activated row so
 * the caller can notify the requester.
 */
const acceptRequest = async (conversationId, userId) => {
  const result = await db.query(
    `UPDATE public.conversations
        SET status = 'active'
      WHERE id = $1 AND status = 'requested'
        AND (user_a = $2 OR user_b = $2) AND requester_id <> $2
      RETURNING *;`,
    [conversationId, userId]
  );
  return result.rows[0];
};

/** Mute hides push only (§0); `null` minutes clears the mute. */
const muteConversation = async (conversationId, userId, muteMinutes) => {
  const sql = `
    INSERT INTO public.conversation_state (conversation_id, user_id, muted_until)
    VALUES ($1, $2,
      CASE WHEN $3::int IS NULL THEN NULL ELSE NOW() + ($3::int * INTERVAL '1 minute') END)
    ON CONFLICT (conversation_id, user_id) DO UPDATE
      SET muted_until = CASE WHEN $3::int IS NULL THEN NULL
                             ELSE NOW() + ($3::int * INTERVAL '1 minute') END
    RETURNING *;
  `;
  const result = await db.query(sql, [conversationId, userId, muteMinutes]);
  return result.rows[0];
};

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const MESSAGE_COLUMNS =
  "id, conversation_id, sender_id, recipient_id, seq, body, delivered_at, read_at, created_at";

/**
 * History (newest `limit`, ascending in the response) or catch-up (`seq >
 * since_seq`, ascending). Ordering is always by `seq`, never `created_at`
 * (§7), so a delayed commit cannot reorder the thread.
 */
const listMessages = async (conversationId, { limit = DEFAULT_LIMIT, sinceSeq = null, beforeSeq = null } = {}) => {
  if (sinceSeq !== null && sinceSeq !== undefined) {
    const result = await db.query(
      `SELECT ${MESSAGE_COLUMNS} FROM public.messages
        WHERE conversation_id = $1 AND seq > $2
        ORDER BY seq ASC LIMIT $3;`,
      [conversationId, sinceSeq, limit]
    );
    return result.rows;
  }

  const params = [conversationId];
  let beforeClause = "";
  if (beforeSeq !== null && beforeSeq !== undefined) {
    beforeClause = "AND seq < $2";
    params.push(beforeSeq);
  }
  params.push(limit);
  const result = await db.query(
    `SELECT ${MESSAGE_COLUMNS} FROM public.messages
      WHERE conversation_id = $1 ${beforeClause}
      ORDER BY seq DESC LIMIT $${params.length};`,
    params
  );
  return result.rows.reverse();
};

const getMessageById = async (id) => {
  const result = await db.query(
    `SELECT ${MESSAGE_COLUMNS} FROM public.messages WHERE id = $1;`,
    [id]
  );
  return result.rows[0];
};

/**
 * The atomic send (§11). In one transaction:
 *   1. lock + load the conversation and confirm the caller is a participant
 *   2. re-evaluate the permission engine (block is a hard stop, always)
 *   3. a recipient replying to a request implicitly accepts it
 *   4. INSERT the message idempotently on (sender_id, client_msg_id)
 *   5. bump the conversation and record the notification
 *
 * Returns `{ message, status, deduped }`; throws a 403/404 as appropriate.
 */
const sendMessage = async ({ conversationId, senderId, body, clientMsgId, senderName }) => {
  return db.withTransaction(async (client) => {
    const convo = (
      await client.query(
        `SELECT * FROM public.conversations
          WHERE id = $1 AND (user_a = $2 OR user_b = $2) FOR UPDATE;`,
        [conversationId, senderId]
      )
    ).rows[0];
    if (!convo) throw notFoundError();

    const recipientId = convo.user_a === senderId ? convo.user_b : convo.user_a;

    // Re-evaluated on every send: a mid-session block must stop everything.
    const decision = await canMessage(senderId, recipientId, client);
    if (decision === "blocked") throw blockedError();
    if (decision === null) throw notFoundError();

    // Only the requester may keep sending while a thread is `requested`; the
    // recipient replying is an implicit accept.
    let status = convo.status;
    if (status === "requested" && senderId !== convo.requester_id) {
      await client.query(`UPDATE public.conversations SET status = 'active' WHERE id = $1;`, [
        conversationId,
      ]);
      status = "active";
    }

    const inserted = await client.query(
      `INSERT INTO public.messages (conversation_id, sender_id, recipient_id, client_msg_id, body)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sender_id, client_msg_id) DO NOTHING
       RETURNING ${MESSAGE_COLUMNS};`,
      [conversationId, senderId, recipientId, clientMsgId, body]
    );

    if (inserted.rows.length === 0) {
      // Idempotent retry: return the already-stored row, change nothing else.
      const existing = await client.query(
        `SELECT ${MESSAGE_COLUMNS} FROM public.messages WHERE sender_id = $1 AND client_msg_id = $2;`,
        [senderId, clientMsgId]
      );
      return { message: existing.rows[0], status, deduped: true };
    }

    const message = inserted.rows[0];

    await client.query(`UPDATE public.conversations SET last_message_at = NOW() WHERE id = $1;`, [
      conversationId,
    ]);

    // Make sure both participants have a conversation_state row (read marker).
    await client.query(
      `INSERT INTO public.conversation_state (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)
       ON CONFLICT (conversation_id, user_id) DO NOTHING;`,
      [conversationId, senderId, recipientId]
    );

    // Row is always written (guaranteed); mute only affects push (§10).
    await notificationService.notifyUser(
      {
        userId: recipientId,
        actorId: senderId,
        type: status === "requested" ? "message_request" : "new_message",
        targetId: conversationId,
        message:
          status === "requested"
            ? `${senderName} sent you a message request.`
            : `${senderName}: ${body.slice(0, 80)}`,
      },
      client
    );

    return { message, status, deduped: false };
  });
};

/** Delivery ack — persisted, not derived from presence (§9). Idempotent. */
const markDelivered = async (messageId, recipientId) => {
  const result = await db.query(
    `UPDATE public.messages
        SET delivered_at = COALESCE(delivered_at, NOW())
      WHERE id = $1 AND recipient_id = $2
      RETURNING ${MESSAGE_COLUMNS};`,
    [messageId, recipientId]
  );
  return result.rows[0];
};

/**
 * Batched read receipt (§9): marks every incoming message up to `uptoSeq` as
 * read, advances the read marker, and clears the thread's bell rows.
 */
const markRead = async (conversationId, userId, uptoSeq) => {
  return db.withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE public.messages
          SET read_at = COALESCE(read_at, NOW())
        WHERE conversation_id = $1 AND recipient_id = $2
          AND read_at IS NULL AND seq <= $3
        RETURNING id, seq;`,
      [conversationId, userId, uptoSeq]
    );

    await client.query(
      `INSERT INTO public.conversation_state (conversation_id, user_id, last_read_seq)
       VALUES ($1, $2, $3)
       ON CONFLICT (conversation_id, user_id) DO UPDATE
         SET last_read_seq = GREATEST(public.conversation_state.last_read_seq, EXCLUDED.last_read_seq);`,
      [conversationId, userId, uptoSeq]
    );

    await client.query(
      `UPDATE public.notifications SET is_read = TRUE
        WHERE user_id = $1 AND target_id = $2
          AND type IN ('new_message', 'message_request');`,
      [userId, conversationId]
    );

    return { updated: updated.rows, last_read_seq: uptoSeq };
  });
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** One report per (message, reporter); a repeat is a no-op. */
const reportMessage = async (messageId, reporterId, reason = null) => {
  const result = await db.query(
    `INSERT INTO public.message_reports (message_id, reporter_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (message_id, reporter_id) DO NOTHING
     RETURNING id, message_id, reporter_id, reason, status, created_at;`,
    [messageId, reporterId, reason]
  );
  return result.rows[0] || null;
};

module.exports = {
  // permission engine
  canMessage,
  resolveDecision,
  // conversations
  getOrCreateConversation,
  getConversationForParticipant,
  listConversations,
  listRequests,
  acceptRequest,
  muteConversation,
  // messages
  listMessages,
  getMessageById,
  sendMessage,
  markDelivered,
  markRead,
  // reports
  reportMessage,
};
