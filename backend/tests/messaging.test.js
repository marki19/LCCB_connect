// Messaging HTTP contract (Messaging_plan.md §6, §9, §11). Auth, the models, and
// the notification service are stubbed, so the routes are exercised without a
// database: authorization shape, request-vs-direct, idempotent send, validation.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");
const messageModel = require("../models/messageModel");
const notificationService = require("../services/notificationService");

const PEER = "22222222-2222-4222-8222-222222222222";
const CONV = "33333333-3333-4333-8333-333333333333";
const MSG = "44444444-4444-4444-8444-444444444444";
const CLIENT = "55555555-5555-4555-8555-555555555555";

const session = { id: "u1" };

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: session.id };
  return next();
});
stub(auth, "loadProfile", (req, res, next) => {
  req.profile = { id: session.id, full_name: "Ana Cruz" };
  return next();
});

const m = {
  canMessage: stub(messageModel, "canMessage"),
  getConversationForParticipant: stub(messageModel, "getConversationForParticipant"),
  getOrCreateConversation: stub(messageModel, "getOrCreateConversation"),
  listConversations: stub(messageModel, "listConversations"),
  listRequests: stub(messageModel, "listRequests"),
  acceptRequest: stub(messageModel, "acceptRequest"),
  listMessages: stub(messageModel, "listMessages"),
  sendMessage: stub(messageModel, "sendMessage"),
  markRead: stub(messageModel, "markRead"),
  markDelivered: stub(messageModel, "markDelivered"),
  muteConversation: stub(messageModel, "muteConversation"),
  getMessageById: stub(messageModel, "getMessageById"),
  reportMessage: stub(messageModel, "reportMessage"),
};

stub(notificationService, "notifyUser", async () => {});
stub(notificationService, "getTargetAdmins", async () => []);
stub(notificationService, "createNotifications", async () => {});

const app = require("../app");
const AUTH = { Authorization: "Bearer test-token" };

beforeEach(() => {
  for (const fn of Object.values(m)) {
    fn.calls.length = 0;
    fn.setImpl(() => undefined);
  }
  session.id = "u1";
});

describe("messaging requires auth", () => {
  it("401 without a token on every messaging mount", async () => {
    const cases = [
      ["get", "/api/conversations"],
      ["post", "/api/conversations"],
      ["get", "/api/conversations/requests"],
      ["post", `/api/conversations/${CONV}/messages`],
      ["post", `/api/messages/${MSG}/delivered`],
      ["get", "/api/friends"],
      ["get", "/api/users/me/message-policy"],
    ];
    for (const [method, path] of cases) {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401, `${method.toUpperCase()} ${path} should require auth`);
    }
  });
});

describe("open a conversation (§4 request-vs-direct)", () => {
  it("400 when messaging yourself", async () => {
    const res = await request(app)
      .post("/api/conversations")
      .set(AUTH)
      .send({ peer_id: "u1" });

    assert.equal(res.status, 400);
    assert.equal(m.canMessage.calls.length, 0);
  });

  it("404 when the peer does not exist", async () => {
    m.canMessage.setImpl(async () => null);

    const res = await request(app)
      .post("/api/conversations")
      .set(AUTH)
      .send({ peer_id: PEER });

    assert.equal(res.status, 404);
    assert.equal(m.getOrCreateConversation.calls.length, 0);
  });

  it("403 with a generic message when blocked", async () => {
    m.canMessage.setImpl(async () => "blocked");

    const res = await request(app)
      .post("/api/conversations")
      .set(AUTH)
      .send({ peer_id: PEER });

    assert.equal(res.status, 403);
    // The response must not disclose block-vs-policy.
    assert.deepEqual(res.body, { error: "This user isn't accepting messages" });
    assert.equal(m.getOrCreateConversation.calls.length, 0);
  });

  it("creates an ACTIVE thread when the decision is direct", async () => {
    m.canMessage.setImpl(async () => "direct");
    m.getOrCreateConversation.setImpl(async (a, b, status) => ({ id: CONV, status }));

    const res = await request(app)
      .post("/api/conversations")
      .set(AUTH)
      .send({ peer_id: PEER });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, "active");
    assert.deepEqual(m.getOrCreateConversation.calls[0], ["u1", PEER, "active"]);
  });

  it("creates a REQUESTED thread when the decision is request", async () => {
    m.canMessage.setImpl(async () => "request");
    m.getOrCreateConversation.setImpl(async (a, b, status) => ({ id: CONV, status }));

    const res = await request(app)
      .post("/api/conversations")
      .set(AUTH)
      .send({ peer_id: PEER });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, "requested");
    assert.deepEqual(m.getOrCreateConversation.calls[0], ["u1", PEER, "requested"]);
  });

  it("400 on a non-uuid peer_id", async () => {
    const res = await request(app)
      .post("/api/conversations")
      .set(AUTH)
      .send({ peer_id: "not-a-uuid" });

    assert.equal(res.status, 400);
    assert.equal(m.canMessage.calls.length, 0);
  });
});

describe("send a message (§11)", () => {
  it("404 for a non-participant (never 403, so ids can't be probed)", async () => {
    m.sendMessage.setImpl(async () => {
      const err = new Error("Conversation not found");
      err.status = 404;
      throw err;
    });

    const res = await request(app)
      .post(`/api/conversations/${CONV}/messages`)
      .set(AUTH)
      .send({ body: "hello", client_msg_id: CLIENT });

    assert.equal(res.status, 404);
  });

  it("403 propagates the blocked (generic) error from the send path", async () => {
    m.sendMessage.setImpl(async () => {
      const err = new Error("This user isn't accepting messages");
      err.status = 403;
      throw err;
    });

    const res = await request(app)
      .post(`/api/conversations/${CONV}/messages`)
      .set(AUTH)
      .send({ body: "hello", client_msg_id: CLIENT });

    assert.equal(res.status, 403);
    assert.deepEqual(res.body, { error: "This user isn't accepting messages" });
  });

  it("stamps the sender from the token and returns 201", async () => {
    m.sendMessage.setImpl(async () => ({
      message: { id: MSG, conversation_id: CONV, sender_id: "u1", body: "hello" },
      status: "active",
      deduped: false,
    }));

    const res = await request(app)
      .post(`/api/conversations/${CONV}/messages`)
      .set(AUTH)
      .send({ body: "hello", client_msg_id: CLIENT });

    assert.equal(res.status, 201);
    const args = m.sendMessage.calls[0][0];
    assert.equal(args.senderId, "u1");
    assert.equal(args.body, "hello");
    assert.equal(args.clientMsgId, CLIENT);
  });

  it("replays an idempotent retry as 200 (no duplicate bubble)", async () => {
    m.sendMessage.setImpl(async () => ({
      message: { id: MSG, conversation_id: CONV, sender_id: "u1", body: "hello" },
      status: "active",
      deduped: true,
    }));

    const res = await request(app)
      .post(`/api/conversations/${CONV}/messages`)
      .set(AUTH)
      .send({ body: "hello", client_msg_id: CLIENT });

    assert.equal(res.status, 200);
  });

  it("rejects an empty body, a bad client id, and unknown keys with 400", async () => {
    const cases = [
      { body: "", client_msg_id: CLIENT },
      { body: "hi", client_msg_id: "nope" },
      { body: "hi", client_msg_id: CLIENT, sender_id: "attacker" },
    ];
    for (const payload of cases) {
      const res = await request(app)
        .post(`/api/conversations/${CONV}/messages`)
        .set(AUTH)
        .send(payload);
      assert.equal(res.status, 400, JSON.stringify(payload));
    }
    assert.equal(m.sendMessage.calls.length, 0);
  });
});

describe("reads and receipts (§9)", () => {
  it("404s message history for a non-participant", async () => {
    m.getConversationForParticipant.setImpl(async () => undefined);

    const res = await request(app).get(`/api/conversations/${CONV}/messages`).set(AUTH);

    assert.equal(res.status, 404);
    assert.equal(m.listMessages.calls.length, 0);
  });

  it("passes since_seq through and clamps the limit", async () => {
    m.getConversationForParticipant.setImpl(async () => ({ id: CONV, status: "active" }));
    m.listMessages.setImpl(async () => []);

    const res = await request(app)
      .get(`/api/conversations/${CONV}/messages?since_seq=42&limit=99999`)
      .set(AUTH);

    assert.equal(res.status, 200);
    const opts = m.listMessages.calls[0][1];
    assert.equal(opts.sinceSeq, 42);
    assert.equal(opts.limit, 100, "limit must be clamped");
  });

  it("marks read with the caller as the reader", async () => {
    m.getConversationForParticipant.setImpl(async () => ({ id: CONV, status: "active" }));
    m.markRead.setImpl(async () => ({ updated: [], last_read_seq: 7 }));

    const res = await request(app)
      .post(`/api/conversations/${CONV}/read`)
      .set(AUTH)
      .send({ upto_seq: 7 });

    assert.equal(res.status, 200);
    assert.deepEqual(m.markRead.calls[0], [CONV, "u1", 7]);
  });

  it("404 when the delivery ack is not for the caller", async () => {
    m.markDelivered.setImpl(async () => undefined);

    const res = await request(app).post(`/api/messages/${MSG}/delivered`).set(AUTH);

    assert.equal(res.status, 404);
  });

  it("accepts a request and returns the activated thread", async () => {
    m.acceptRequest.setImpl(async () => ({
      id: CONV,
      status: "active",
      requester_id: "u2",
    }));

    const res = await request(app).post(`/api/conversations/${CONV}/accept`).set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "active");
    assert.deepEqual(m.acceptRequest.calls[0], [CONV, "u1"]);
  });

  it("404 when a non-recipient tries to accept", async () => {
    m.acceptRequest.setImpl(async () => undefined);

    const res = await request(app).post(`/api/conversations/${CONV}/accept`).set(AUTH);

    assert.equal(res.status, 404);
  });
});

describe("report a message (§7)", () => {
  it("201 when a participant reports a message", async () => {
    m.getMessageById.setImpl(async () => ({ id: MSG, conversation_id: CONV }));
    m.getConversationForParticipant.setImpl(async () => ({ id: CONV, status: "active" }));
    m.reportMessage.setImpl(async () => ({ id: "r1", message_id: MSG, status: "open" }));

    const res = await request(app)
      .post(`/api/messages/${MSG}/report`)
      .set(AUTH)
      .send({ reason: "Harassment" });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, "open");
    assert.deepEqual(m.reportMessage.calls[0], [MSG, "u1", "Harassment"]);
  });

  it("404 when the message does not exist", async () => {
    m.getMessageById.setImpl(async () => undefined);

    const res = await request(app).post(`/api/messages/${MSG}/report`).set(AUTH).send({});

    assert.equal(res.status, 404);
    assert.equal(m.reportMessage.calls.length, 0);
  });

  it("404 when the reporter is not a participant (ids can't be probed)", async () => {
    m.getMessageById.setImpl(async () => ({ id: MSG, conversation_id: CONV }));
    m.getConversationForParticipant.setImpl(async () => undefined);

    const res = await request(app).post(`/api/messages/${MSG}/report`).set(AUTH).send({});

    assert.equal(res.status, 404);
    assert.equal(m.reportMessage.calls.length, 0);
  });

  it("400 on a too-long reason or an unknown key", async () => {
    const cases = [{ reason: "x".repeat(501) }, { reason: "ok", message_id: MSG }];
    for (const payload of cases) {
      const res = await request(app).post(`/api/messages/${MSG}/report`).set(AUTH).send(payload);
      assert.equal(res.status, 400, JSON.stringify(payload));
    }
    assert.equal(m.reportMessage.calls.length, 0);
  });
});
