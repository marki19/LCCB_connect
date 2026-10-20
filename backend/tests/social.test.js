// Social settings: message policy, presence, device tokens, blocks, and the
// friends graph (Messaging_plan.md §4, §5, §7, §8). Models + notification
// service are stubbed so the HTTP contract is asserted without a database.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");
const socialModel = require("../models/socialModel");
const friendModel = require("../models/friendModel");
const notificationService = require("../services/notificationService");

const DEPT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const FRIENDSHIP = "33333333-3333-4333-8333-333333333333";

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

const social = {
  getMessagePolicy: stub(socialModel, "getMessagePolicy"),
  setMessagePolicy: stub(socialModel, "setMessagePolicy"),
  setPresenceMode: stub(socialModel, "setPresenceMode"),
  heartbeat: stub(socialModel, "heartbeat"),
  addDeviceToken: stub(socialModel, "addDeviceToken"),
  removeDeviceToken: stub(socialModel, "removeDeviceToken"),
  block: stub(socialModel, "block"),
  unblock: stub(socialModel, "unblock"),
  isBlocked: stub(socialModel, "isBlocked"),
};

const friends = {
  getPair: stub(friendModel, "getPair"),
  upsertRequest: stub(friendModel, "upsertRequest"),
  respond: stub(friendModel, "respond"),
  removePair: stub(friendModel, "removePair"),
  listFriends: stub(friendModel, "listFriends"),
  listIncomingRequests: stub(friendModel, "listIncomingRequests"),
  listOutgoingRequests: stub(friendModel, "listOutgoingRequests"),
};

stub(notificationService, "notifyUser", async () => {});

const app = require("../app");
const AUTH = { Authorization: "Bearer test-token" };

beforeEach(() => {
  for (const fn of [...Object.values(social), ...Object.values(friends)]) {
    fn.calls.length = 0;
    fn.setImpl(() => undefined);
  }
  session.id = "u1";
});

describe("who-can-message-me policy (§4)", () => {
  it("returns the stored policy + allow-list", async () => {
    social.getMessagePolicy.setImpl(async () => ({
      message_policy: "selected",
      department_ids: [DEPT],
    }));

    const res = await request(app).get("/api/users/me/message-policy").set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(res.body.message_policy, "selected");
    assert.deepEqual(res.body.department_ids, [DEPT]);
  });

  it("rejects an unknown policy value and unknown keys", async () => {
    const bad = await request(app)
      .put("/api/users/me/message-policy")
      .set(AUTH)
      .send({ message_policy: "friends-only" });
    assert.equal(bad.status, 400);

    const extra = await request(app)
      .put("/api/users/me/message-policy")
      .set(AUTH)
      .send({ message_policy: "everyone", user_id: "attacker" });
    assert.equal(extra.status, 400);

    assert.equal(social.setMessagePolicy.calls.length, 0);
  });

  it("passes the allow-list only for the `selected` policy", async () => {
    social.setMessagePolicy.setImpl(async () => ({
      message_policy: "selected",
      department_ids: [DEPT],
    }));

    await request(app)
      .put("/api/users/me/message-policy")
      .set(AUTH)
      .send({ message_policy: "selected", department_ids: [DEPT] });
    assert.deepEqual(social.setMessagePolicy.calls.at(-1), ["u1", "selected", [DEPT]]);

    // `everyone` ignores the department list entirely.
    await request(app)
      .put("/api/users/me/message-policy")
      .set(AUTH)
      .send({ message_policy: "everyone", department_ids: [DEPT] });
    assert.deepEqual(social.setMessagePolicy.calls.at(-1), ["u1", "everyone", undefined]);
  });
});

describe("presence & device tokens (§7, §8)", () => {
  it("sets the presence mode", async () => {
    social.setPresenceMode.setImpl(async () => ({ presence_mode: "dnd" }));

    const res = await request(app).post("/api/users/me/presence").set(AUTH).send({ mode: "dnd" });

    assert.equal(res.status, 200);
    assert.deepEqual(social.setPresenceMode.calls[0], ["u1", "dnd"]);
  });

  it("rejects an invalid presence mode", async () => {
    const res = await request(app).post("/api/users/me/presence").set(AUTH).send({ mode: "ghost" });
    assert.equal(res.status, 400);
    assert.equal(social.setPresenceMode.calls.length, 0);
  });

  it("heartbeats with optional mode + visibility", async () => {
    social.heartbeat.setImpl(async () => ({ last_seen_at: "2026-01-01T00:00:00Z" }));

    const res = await request(app)
      .post("/api/users/me/heartbeat")
      .set(AUTH)
      .send({ mode: "away", last_seen_visible: true });

    assert.equal(res.status, 200);
    assert.deepEqual(social.heartbeat.calls[0], ["u1", { mode: "away", lastSeenVisible: true }]);
  });

  it("registers and removes a device token", async () => {
    social.addDeviceToken.setImpl(async () => ({ id: "t1" }));
    const add = await request(app)
      .post("/api/users/me/device-tokens")
      .set(AUTH)
      .send({ token: "ExpoToken[abc]", platform: "android" });
    assert.equal(add.status, 201);
    assert.deepEqual(social.addDeviceToken.calls[0], ["u1", "ExpoToken[abc]", "android"]);

    social.removeDeviceToken.setImpl(async () => ({ id: "t1" }));
    const remove = await request(app)
      .delete("/api/users/me/device-tokens")
      .set(AUTH)
      .send({ token: "ExpoToken[abc]" });
    assert.equal(remove.status, 200);
    assert.equal(remove.body.removed, true);
  });

  it("rejects an unknown platform", async () => {
    const res = await request(app)
      .post("/api/users/me/device-tokens")
      .set(AUTH)
      .send({ token: "x", platform: "symbian" });
    assert.equal(res.status, 400);
  });
});

describe("blocks (§7)", () => {
  it("400 when blocking yourself", async () => {
    const res = await request(app).post("/api/users/u1/block").set(AUTH);
    assert.equal(res.status, 400);
    assert.equal(social.block.calls.length, 0);
  });

  it("blocks and unblocks another user", async () => {
    social.block.setImpl(async () => ({ blocker_id: "u1", blocked_id: USER }));
    const block = await request(app).post(`/api/users/${USER}/block`).set(AUTH);
    assert.equal(block.status, 201);
    assert.deepEqual(social.block.calls[0], ["u1", USER]);

    social.unblock.setImpl(async () => ({ blocker_id: "u1", blocked_id: USER }));
    const unblock = await request(app).delete(`/api/users/${USER}/block`).set(AUTH);
    assert.equal(unblock.body.unblocked, true);
  });
});

describe("friends (§5)", () => {
  it("403 for a blocked pair (block is checked first)", async () => {
    social.isBlocked.setImpl(async () => true);

    const res = await request(app)
      .post("/api/friends/requests")
      .set(AUTH)
      .send({ addressee_id: USER });

    assert.equal(res.status, 403);
    assert.equal(friends.upsertRequest.calls.length, 0);
  });

  it("409 when already friends", async () => {
    social.isBlocked.setImpl(async () => false);
    friends.getPair.setImpl(async () => ({ status: "accepted" }));

    const res = await request(app)
      .post("/api/friends/requests")
      .set(AUTH)
      .send({ addressee_id: USER });

    assert.equal(res.status, 409);
  });

  it("creates a pending request", async () => {
    social.isBlocked.setImpl(async () => false);
    friends.getPair.setImpl(async () => undefined);
    friends.upsertRequest.setImpl(async () => ({ id: FRIENDSHIP, status: "pending" }));

    const res = await request(app)
      .post("/api/friends/requests")
      .set(AUTH)
      .send({ addressee_id: USER });

    assert.equal(res.status, 201);
    assert.deepEqual(friends.upsertRequest.calls[0], ["u1", USER]);
  });

  it("400 when adding yourself", async () => {
    const res = await request(app)
      .post("/api/friends/requests")
      .set(AUTH)
      .send({ addressee_id: "u1" });

    assert.equal(res.status, 400);
  });

  it("404 when a non-addressee tries to accept", async () => {
    friends.respond.setImpl(async () => undefined);

    const res = await request(app)
      .post(`/api/friends/requests/${FRIENDSHIP}/accept`)
      .set(AUTH);

    assert.equal(res.status, 404);
    assert.deepEqual(friends.respond.calls[0], [FRIENDSHIP, "u1", "accepted"]);
  });

  it("accepts a request and returns the friendship", async () => {
    friends.respond.setImpl(async () => ({
      id: FRIENDSHIP,
      status: "accepted",
      requester_id: "u2",
    }));

    const res = await request(app)
      .post(`/api/friends/requests/${FRIENDSHIP}/accept`)
      .set(AUTH);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "accepted");
  });
});
