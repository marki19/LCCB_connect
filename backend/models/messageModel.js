const db = require("../db");

/**
 * Relationship-based permission engine (Messaging_plan.md §4).
 *
 * Decides whether `sender` may open a thread with `recipient`, from one
 * round-trip (CTE) of relationship facts. Returns:
 *   'direct'  → conversation is created `active`
 *   'request' → conversation is created `requested` (§6)
 *   'blocked' → refuse with a generic message (never reveal block vs policy)
 *   null      → sender or recipient profile does not exist
 *
 * The decision is evaluated server-side on every create/send. `senderId` /
 * `recipientId` must come from the verified token or a participant check — never
 * from a request body.
 */
const canMessage = async (senderId, recipientId) => {
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
  const { rows } = await db.query(sql, [senderId, recipientId]);
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

module.exports = { canMessage, resolveDecision };
