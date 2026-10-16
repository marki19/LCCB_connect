// Push service (Messaging_plan.md §10, Phase 5). `db.query` and the device-token
// model are stubbed, and `fetch` is injected, so the Expo Push API contract is
// exercised without any network or database access.
require("./env.helper");
process.env.PUSH_ENABLED = "true";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const { stub } = require("./stub.helper");
const db = require("../db");
const socialModel = require("../models/socialModel");
const pushService = require("../services/pushService");

const query = stub(db, "query");
const listDeviceTokens = stub(socialModel, "listDeviceTokens");
const deleteDeviceTokens = stub(socialModel, "deleteDeviceTokens", async () => 0);

const CONV = "33333333-3333-4333-8333-333333333333";

const prefs = (over = {}) => ({ presence_mode: "online", muted_until: null, ...over });

const token = (n = "a") => ({ id: `t-${n}`, token: `ExponentPushToken[${n}]`, platform: "ios" });

const okResponse = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });

/** A fake fetch that records each request body and replies via `responder`. */
const fakeFetch = (responder) => {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return responder(calls.length);
  };
  fn.calls = calls;
  return fn;
};

const messageArgs = (over = {}) => ({
  recipientId: "u2",
  senderId: "u1",
  senderName: "Ana Cruz",
  body: "Hello there",
  conversationId: CONV,
  ...over,
});

beforeEach(() => {
  process.env.PUSH_ENABLED = "true";
  query.calls.length = 0;
  listDeviceTokens.calls.length = 0;
  deleteDeviceTokens.calls.length = 0;
  query.setImpl(async () => ({ rows: [prefs()] }));
  listDeviceTokens.setImpl(async () => [token()]);
  deleteDeviceTokens.setImpl(async () => 0);
});

describe("pushService.notifyNewMessage (§10)", () => {
  it("suppresses push entirely when the recipient is in DND", async () => {
    query.setImpl(async () => ({ rows: [prefs({ presence_mode: "dnd" })] }));
    const fetchImpl = fakeFetch(() => okResponse([]));

    const tickets = await pushService.notifyNewMessage(messageArgs(), { fetchImpl });

    assert.deepEqual(tickets, []);
    assert.equal(fetchImpl.calls.length, 0);
    assert.equal(listDeviceTokens.calls.length, 0);
  });

  it("suppresses push while the conversation is muted (row is kept)", async () => {
    query.setImpl(async () => ({
      rows: [prefs({ muted_until: new Date(Date.now() + 60_000).toISOString() })],
    }));
    const fetchImpl = fakeFetch(() => okResponse([]));

    const tickets = await pushService.notifyNewMessage(messageArgs(), { fetchImpl });

    assert.deepEqual(tickets, []);
    assert.equal(fetchImpl.calls.length, 0);
  });

  it("does not suppress when a mute has already expired", async () => {
    query.setImpl(async () => ({
      rows: [prefs({ muted_until: new Date(Date.now() - 60_000).toISOString() })],
    }));
    const fetchImpl = fakeFetch(() => okResponse([{ status: "ok" }]));

    await pushService.notifyNewMessage(messageArgs(), { fetchImpl });

    assert.equal(fetchImpl.calls.length, 1);
  });

  it("sends a normal, high-priority payload with a short preview", async () => {
    const fetchImpl = fakeFetch(() => okResponse([{ status: "ok" }]));

    await pushService.notifyNewMessage(messageArgs(), { fetchImpl });

    const [payload] = fetchImpl.calls[0].body;
    assert.equal(payload.to, "ExponentPushToken[a]");
    assert.equal(payload.title, "Ana Cruz");
    assert.equal(payload.body, "Hello there");
    assert.equal(payload.sound, "default");
    assert.equal(payload.priority, "high");
    assert.deepEqual(payload.data, {
      type: "new_message",
      conversationId: CONV,
      actorId: "u1",
    });
  });

  it("truncates the preview to 80 characters (never the full body)", async () => {
    const fetchImpl = fakeFetch(() => okResponse([{ status: "ok" }]));
    const long = "x".repeat(500);

    await pushService.notifyNewMessage(messageArgs({ body: long }), { fetchImpl });

    assert.equal(fetchImpl.calls[0].body[0].body.length, 80);
  });

  it("sends a quiet payload for a message request", async () => {
    const fetchImpl = fakeFetch(() => okResponse([{ status: "ok" }]));

    await pushService.notifyNewMessage(messageArgs({ isRequest: true }), { fetchImpl });

    const [payload] = fetchImpl.calls[0].body;
    assert.equal(payload.sound, null);
    assert.equal(payload.priority, "normal");
    assert.equal(payload.data.type, "message_request");
    assert.match(payload.body, /message request/);
  });

  it("pushes to every device token (multi-device)", async () => {
    listDeviceTokens.setImpl(async () => [token("a"), token("b")]);
    const fetchImpl = fakeFetch(() => okResponse([{ status: "ok" }, { status: "ok" }]));

    await pushService.notifyNewMessage(messageArgs(), { fetchImpl });

    assert.equal(fetchImpl.calls[0].body.length, 2);
  });

  it("does nothing when the user has no registered devices", async () => {
    listDeviceTokens.setImpl(async () => []);
    const fetchImpl = fakeFetch(() => okResponse([]));

    const tickets = await pushService.notifyNewMessage(messageArgs(), { fetchImpl });

    assert.deepEqual(tickets, []);
    assert.equal(fetchImpl.calls.length, 0);
  });

  it("prunes tokens Expo reports as DeviceNotRegistered", async () => {
    const fetchImpl = fakeFetch(() =>
      okResponse([{ status: "error", details: { error: "DeviceNotRegistered" } }])
    );

    await pushService.notifyNewMessage(messageArgs(), { fetchImpl });

    assert.equal(deleteDeviceTokens.calls.length, 1);
    assert.deepEqual(deleteDeviceTokens.calls[0][0], ["ExponentPushToken[a]"]);
  });

  it("never throws when the Expo API returns an error", async () => {
    const fetchImpl = async () => ({ ok: false, status: 500 });

    const tickets = await pushService.notifyNewMessage(messageArgs(), { fetchImpl });

    assert.deepEqual(tickets, []);
  });

  it("never throws when fetch itself rejects", async () => {
    const fetchImpl = async () => {
      throw new Error("network down");
    };

    const tickets = await pushService.notifyNewMessage(messageArgs(), { fetchImpl });

    assert.deepEqual(tickets, []);
  });
});

describe("pushService.notifyFriendEvent (§10)", () => {
  it("sends a quiet push for a friend request", async () => {
    const fetchImpl = fakeFetch(() => okResponse([{ status: "ok" }]));

    await pushService.notifyFriendEvent(
      { recipientId: "u2", actorId: "u1", actorName: "Ana Cruz", type: "friend_request" },
      { fetchImpl }
    );

    const [payload] = fetchImpl.calls[0].body;
    assert.equal(payload.sound, null);
    assert.equal(payload.data.type, "friend_request");
  });

  it("sends a sounding push when a friend request is accepted", async () => {
    const fetchImpl = fakeFetch(() => okResponse([{ status: "ok" }]));

    await pushService.notifyFriendEvent(
      { recipientId: "u2", actorId: "u1", actorName: "Ana Cruz", type: "friend_accepted" },
      { fetchImpl }
    );

    const [payload] = fetchImpl.calls[0].body;
    assert.equal(payload.sound, "default");
    assert.equal(payload.data.type, "friend_accepted");
  });
});

describe("pushService.sendExpoPush chunking", () => {
  it("splits payloads into Expo's 100-per-request limit", async () => {
    const payloads = Array.from({ length: 150 }, (_, i) => ({ to: `t${i}` }));
    const fetchImpl = fakeFetch(() => okResponse([]));

    await pushService.sendExpoPush(payloads, fetchImpl);

    assert.equal(fetchImpl.calls.length, 2);
    assert.equal(fetchImpl.calls[0].body.length, 100);
    assert.equal(fetchImpl.calls[1].body.length, 50);
    assert.match(fetchImpl.calls[0].url, /exp\.host/);
  });

  it("does nothing for an empty payload list", async () => {
    const fetchImpl = fakeFetch(() => okResponse([]));
    await pushService.sendExpoPush([], fetchImpl);
    assert.equal(fetchImpl.calls.length, 0);
  });
});

describe("pushService.pushEnabled", () => {
  it("short-circuits every query when PUSH_ENABLED=false", async () => {
    process.env.PUSH_ENABLED = "false";
    const fetchImpl = fakeFetch(() => okResponse([]));

    const tickets = await pushService.notifyNewMessage(messageArgs(), { fetchImpl });

    assert.deepEqual(tickets, []);
    assert.equal(query.calls.length, 0);
    assert.equal(fetchImpl.calls.length, 0);
  });
});
