require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");
const { stub } = require("./stub.helper");

const query = stub(db, "query", async () => ({ rows: [] }));
const messageModel = require("../models/messageModel");

const USER = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  query.calls.length = 0;
  query.setImpl(async () => ({ rows: [] }));
});

describe("unread message total", () => {
  it("counts only messages addressed to the caller that are unread", async () => {
    query.setImpl(async () => ({ rows: [{ unread: 7 }] }));

    const result = await messageModel.getUnreadCount(USER);

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /FROM public\.messages/i);
    assert.match(sql, /recipient_id = \$1/i);
    assert.match(sql, /read_at IS NULL/i);
    assert.deepEqual(params, [USER]);
    assert.deepEqual(result, { unread: 7 });
  });

  it("returns zero when the aggregate row is absent", async () => {
    const result = await messageModel.getUnreadCount(USER);
    assert.deepEqual(result, { unread: 0 });
  });
});
