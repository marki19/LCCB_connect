require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");
const { stub } = require("./stub.helper");

const query = stub(db, "query", async () => ({ rows: [] }));
const thesisModel = require("../models/thesisModel");

beforeEach(() => {
  query.calls.length = 0;
  query.setImpl(async () => ({ rows: [] }));
});

describe("thesis visibility", () => {
  it("filters hidden theses out of the list query by default", async () => {
    await thesisModel.getAllTheses({ limit: 10 });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /t\.moderation_status\s*<>\s*'hidden'/i);
    assert.deepEqual(params, [10]);
  });

  it("keeps the hidden filter when a cursor is present", async () => {
    const cursor = "2026-10-20T00:00:00.000Z|11111111-1111-4111-8111-111111111111";
    await thesisModel.getAllTheses({ limit: 10, cursor });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /t\.moderation_status\s*<>\s*'hidden'/i);
    assert.deepEqual(params, [
      "2026-10-20T00:00:00.000Z",
      "11111111-1111-4111-8111-111111111111",
      10,
    ]);
  });

  it("filters hidden theses out of the detail query by default", async () => {
    await thesisModel.getThesisById("11111111-1111-4111-8111-111111111111");

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /t\.moderation_status\s*<>\s*'hidden'/i);
    assert.deepEqual(params, ["11111111-1111-4111-8111-111111111111"]);
  });

  it("can include hidden theses for moderation", async () => {
    await thesisModel.getAllTheses({ limit: 10, includeHidden: true });
    let [sql] = query.calls.at(-1);
    assert.doesNotMatch(sql, /t\.moderation_status\s*<>\s*'hidden'/i);

    await thesisModel.getThesisById("11111111-1111-4111-8111-111111111111", {
      includeHidden: true,
    });
    [sql] = query.calls.at(-1);
    assert.doesNotMatch(sql, /t\.moderation_status\s*<>\s*'hidden'/i);
  });
});
