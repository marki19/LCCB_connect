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
