// Permission engine (§4) unit tests.
//
// The decision table is a pure function, so it is tested exhaustively without a
// database; `canMessage`'s wiring (parameter order, missing-profile handling) is
// tested with `db.query` stubbed. No test touches Postgres.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const { stub } = require("./stub.helper");
const db = require("../db");
const messageModel = require("../models/messageModel");

// Installed on the shared `db` export object; messageModel resolves `db.query`
// at call time, so it sees this stub.
const query = stub(db, "query");

const notificationService = require("../services/notificationService");
const notifyUser = stub(notificationService, "notifyUser", async () => {});
const tx = stub(db, "withTransaction");

const row = (over = {}) => ({
  sender_exists: true,
  recipient_exists: true,
  sender_department_id: "dept-a",
  recipient_department_id: "dept-a",
  recipient_policy: "department",
  is_blocked: false,
  is_friend: false,
  sender_department_allowed: false,
  ...over,
});

describe("permission engine decision table (§4)", () => {
  it("block is a hard stop, even for accepted friends", () => {
    assert.equal(
      messageModel.resolveDecision(row({ is_blocked: true, is_friend: true })),
      "blocked"
    );
  });

  it("an accepted friend bypasses the recipient's policy", () => {
    assert.equal(
      messageModel.resolveDecision(row({ is_friend: true, recipient_policy: "nobody" })),
      "direct"
    );
  });

  it("everyone => direct", () => {
    assert.equal(messageModel.resolveDecision(row({ recipient_policy: "everyone" })), "direct");
  });

  it("department => direct only for the same department_id", () => {
    assert.equal(messageModel.resolveDecision(row({ recipient_policy: "department" })), "direct");
    assert.equal(
      messageModel.resolveDecision(
        row({ recipient_policy: "department", recipient_department_id: "dept-b" })
      ),
      "request"
    );
  });

  it("department fails closed when either side has no department on file", () => {
    assert.equal(
      messageModel.resolveDecision(row({ recipient_policy: "department", sender_department_id: null })),
      "request"
    );
    assert.equal(
      messageModel.resolveDecision(row({ recipient_policy: "department", recipient_department_id: null })),
      "request"
    );
  });

  it("selected => direct only when the sender's department is allow-listed", () => {
    assert.equal(
      messageModel.resolveDecision(row({ recipient_policy: "selected", sender_department_allowed: true })),
      "direct"
    );
    assert.equal(
      messageModel.resolveDecision(row({ recipient_policy: "selected", sender_department_allowed: false })),
      "request"
    );
  });

  it("nobody => request", () => {
    assert.equal(messageModel.resolveDecision(row({ recipient_policy: "nobody" })), "request");
  });

  it("an absent or unknown policy fails safe to request", () => {
    assert.equal(messageModel.resolveDecision(row({ recipient_policy: null })), "request");
    assert.equal(messageModel.resolveDecision(row({ recipient_policy: "garbage" })), "request");
  });
});

describe("canMessage wiring", () => {
  beforeEach(() => {
    query.calls.length = 0;
    query.setImpl(async () => ({ rows: [] }));
  });

  it("passes [sender, recipient] in order and returns null when a profile is missing", async () => {
    query.setImpl(async () => ({ rows: [row({ recipient_exists: false })] }));
    const result = await messageModel.canMessage("u1", "u2");
    assert.equal(result, null);
    assert.deepEqual(query.calls[0][1], ["u1", "u2"]);
  });

  it("returns null when the recipient row is absent entirely", async () => {
    query.setImpl(async () => ({ rows: [] }));
    assert.equal(await messageModel.canMessage("u1", "u2"), null);
  });

  it("maps a blocked relationship to 'blocked'", async () => {
    query.setImpl(async () => ({ rows: [row({ is_blocked: true })] }));
    assert.equal(await messageModel.canMessage("u1", "u2"), "blocked");
  });

  it("returns 'direct' for the same-department default policy", async () => {
    query.setImpl(async () => ({ rows: [row()] }));
    assert.equal(await messageModel.canMessage("u1", "u2"), "direct");
  });
});

// ---------------------------------------------------------------------------
// sendMessage: the atomic send path (§11). `db.withTransaction` is stubbed to
// hand the callback a scripted fake client, so the block/participant/idempotency
// logic is exercised without a database.
// ---------------------------------------------------------------------------

const CONV = "33333333-3333-4333-8333-333333333333";

const conversationRow = (over = {}) => ({
  id: CONV,
  user_a: "u1",
  user_b: "u2",
  requester_id: null,
  status: "active",
  ...over,
});

/** A fake client that dispatches on a SQL substring. */
const fakeClient = (routes) => {
  const seen = [];
  return {
    seen,
    query: async (text) => {
      seen.push(text);
      for (const [needle, fn] of routes) {
        if (text.includes(needle)) return fn();
      }
      throw new Error(`Unexpected SQL in test: ${text}`);
    },
  };
};

describe("sendMessage (atomic send path)", () => {
  beforeEach(() => {
    tx.calls.length = 0;
    notifyUser.calls.length = 0;
    tx.setImpl(async (fn) => fn(undefined));
  });

  it("refuses a blocked send before any INSERT", async () => {
    const client = fakeClient([
      ["FOR UPDATE", () => ({ rows: [conversationRow()] })],
      ["is_blocked", () => ({ rows: [row({ is_blocked: true })] })],
    ]);
    tx.setImpl(async (fn) => fn(client));

    await assert.rejects(
      () =>
        messageModel.sendMessage({
          conversationId: CONV,
          senderId: "u1",
          body: "hi",
          clientMsgId: "c1",
          senderName: "Ana",
        }),
      (err) => err.status === 403
    );
    assert.equal(
      client.seen.some((sql) => sql.includes("INSERT INTO public.messages")),
      false
    );
  });

  it("404s for a non-participant (conversation lookup returns nothing)", async () => {
    const client = fakeClient([["FOR UPDATE", () => ({ rows: [] })]]);
    tx.setImpl(async (fn) => fn(client));

    await assert.rejects(
      () =>
        messageModel.sendMessage({
          conversationId: CONV,
          senderId: "u1",
          body: "hi",
          clientMsgId: "c1",
          senderName: "Ana",
        }),
      (err) => err.status === 404
    );
  });

  it("inserts, bumps the thread, and notifies on a direct send", async () => {
    const message = { id: "m1", conversation_id: CONV, sender_id: "u1", body: "hi" };
    const client = fakeClient([
      ["FOR UPDATE", () => ({ rows: [conversationRow()] })],
      ["is_blocked", () => ({ rows: [row({ is_friend: true })] })],
      ["INSERT INTO public.messages", () => ({ rows: [message] })],
      ["SET last_message_at", () => ({ rows: [] })],
      ["INSERT INTO public.conversation_state", () => ({ rows: [] })],
    ]);
    tx.setImpl(async (fn) => fn(client));

    const result = await messageModel.sendMessage({
      conversationId: CONV,
      senderId: "u1",
      body: "hi",
      clientMsgId: "c1",
      senderName: "Ana",
    });

    assert.equal(result.message, message);
    assert.equal(result.deduped, false);
    assert.equal(notifyUser.calls.length, 1);
    assert.equal(notifyUser.calls[0][0].type, "new_message");
    assert.equal(notifyUser.calls[0][0].userId, "u2");
  });

  it("replays a duplicate client_msg_id without re-notifying", async () => {
    const existing = { id: "m0", conversation_id: CONV, sender_id: "u1", body: "hi" };
    const client = fakeClient([
      ["FOR UPDATE", () => ({ rows: [conversationRow()] })],
      ["is_blocked", () => ({ rows: [row({ is_friend: true })] })],
      ["INSERT INTO public.messages", () => ({ rows: [] })],
      ["client_msg_id = $2", () => ({ rows: [existing] })],
    ]);
    tx.setImpl(async (fn) => fn(client));

    const result = await messageModel.sendMessage({
      conversationId: CONV,
      senderId: "u1",
      body: "hi",
      clientMsgId: "c1",
      senderName: "Ana",
    });

    assert.equal(result.deduped, true);
    assert.equal(result.message, existing);
    assert.equal(notifyUser.calls.length, 0);
  });

  it("implicitly accepts a request when the recipient replies", async () => {
    const message = { id: "m1", conversation_id: CONV, sender_id: "u2", body: "ok" };
    const client = fakeClient([
      ["FOR UPDATE", () => ({
        rows: [conversationRow({ status: "requested", requester_id: "u1" })],
      })],
      ["is_blocked", () => ({ rows: [row()] })],
      ["SET status = 'active'", () => ({ rows: [] })],
      ["INSERT INTO public.messages", () => ({ rows: [message] })],
      ["SET last_message_at", () => ({ rows: [] })],
      ["INSERT INTO public.conversation_state", () => ({ rows: [] })],
    ]);
    tx.setImpl(async (fn) => fn(client));

    const result = await messageModel.sendMessage({
      conversationId: CONV,
      senderId: "u2",
      body: "ok",
      clientMsgId: "c2",
      senderName: "Ben",
    });

    assert.equal(result.status, "active");
    assert.equal(
      client.seen.some((sql) => sql.includes("SET status = 'active'")),
      true
    );
  });

  // --- pre-accept cap (§6 "one-line switch") --------------------------------

  it("messageRequestCap: absent/invalid/non-positive => unlimited (0)", () => {
    const prev = process.env.MESSAGE_REQUEST_MAX;
    try {
      delete process.env.MESSAGE_REQUEST_MAX;
      assert.equal(messageModel.messageRequestCap(), 0);
      process.env.MESSAGE_REQUEST_MAX = "abc";
      assert.equal(messageModel.messageRequestCap(), 0);
      process.env.MESSAGE_REQUEST_MAX = "-1";
      assert.equal(messageModel.messageRequestCap(), 0);
      process.env.MESSAGE_REQUEST_MAX = "3";
      assert.equal(messageModel.messageRequestCap(), 3);
    } finally {
      if (prev === undefined) delete process.env.MESSAGE_REQUEST_MAX;
      else process.env.MESSAGE_REQUEST_MAX = prev;
    }
  });

  it("refuses a pre-accept send once the cap is reached, before any INSERT", async () => {
    const prev = process.env.MESSAGE_REQUEST_MAX;
    process.env.MESSAGE_REQUEST_MAX = "1";
    try {
      const client = fakeClient([
        ["FOR UPDATE", () => ({ rows: [conversationRow({ status: "requested", requester_id: "u1" })] })],
        ["is_blocked", () => ({ rows: [row()] })],
        ["COUNT(*)", () => ({ rows: [{ count: 1 }] })],
      ]);
      tx.setImpl(async (fn) => fn(client));

      await assert.rejects(
        () =>
          messageModel.sendMessage({
            conversationId: CONV,
            senderId: "u1",
            body: "hi",
            clientMsgId: "c1",
            senderName: "Ana",
          }),
        (err) => err.status === 429
      );
      assert.equal(
        client.seen.some((sql) => sql.includes("INSERT INTO public.messages")),
        false
      );
    } finally {
      if (prev === undefined) delete process.env.MESSAGE_REQUEST_MAX;
      else process.env.MESSAGE_REQUEST_MAX = prev;
    }
  });

  it("allows a pre-accept send while under the cap", async () => {
    const prev = process.env.MESSAGE_REQUEST_MAX;
    process.env.MESSAGE_REQUEST_MAX = "3";
    const message = { id: "m1", conversation_id: CONV, sender_id: "u1", body: "hi" };
    try {
      const client = fakeClient([
        ["FOR UPDATE", () => ({ rows: [conversationRow({ status: "requested", requester_id: "u1" })] })],
        ["is_blocked", () => ({ rows: [row()] })],
        ["COUNT(*)", () => ({ rows: [{ count: 1 }] })],
        ["INSERT INTO public.messages", () => ({ rows: [message] })],
        ["SET last_message_at", () => ({ rows: [] })],
        ["INSERT INTO public.conversation_state", () => ({ rows: [] })],
      ]);
      tx.setImpl(async (fn) => fn(client));

      const result = await messageModel.sendMessage({
        conversationId: CONV,
        senderId: "u1",
        body: "hi",
        clientMsgId: "c1",
        senderName: "Ana",
      });
      assert.equal(result.deduped, false);
      assert.equal(result.status, "requested");
    } finally {
      if (prev === undefined) delete process.env.MESSAGE_REQUEST_MAX;
      else process.env.MESSAGE_REQUEST_MAX = prev;
    }
  });

  it("never counts when the cap is unset (unlimited)", async () => {
    const prev = process.env.MESSAGE_REQUEST_MAX;
    delete process.env.MESSAGE_REQUEST_MAX;
    const message = { id: "m1", conversation_id: CONV, sender_id: "u1", body: "hi" };
    try {
      // No "COUNT(*)" route: the fake client throws if the cap path is taken.
      const client = fakeClient([
        ["FOR UPDATE", () => ({ rows: [conversationRow({ status: "requested", requester_id: "u1" })] })],
        ["is_blocked", () => ({ rows: [row()] })],
        ["INSERT INTO public.messages", () => ({ rows: [message] })],
        ["SET last_message_at", () => ({ rows: [] })],
        ["INSERT INTO public.conversation_state", () => ({ rows: [] })],
      ]);
      tx.setImpl(async (fn) => fn(client));

      const result = await messageModel.sendMessage({
        conversationId: CONV,
        senderId: "u1",
        body: "hi",
        clientMsgId: "c1",
        senderName: "Ana",
      });
      assert.equal(result.deduped, false);
    } finally {
      if (prev === undefined) delete process.env.MESSAGE_REQUEST_MAX;
      else process.env.MESSAGE_REQUEST_MAX = prev;
    }
  });
});
