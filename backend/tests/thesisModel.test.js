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

describe("thesis list filters", () => {
  const UPLOADER = "22222222-2222-4222-8222-222222222222";
  const CURSOR = "2026-10-20T00:00:00.000Z|33333333-3333-4333-8333-333333333333";

  it("matches the search term against title and abstract", async () => {
    await thesisModel.getAllTheses({ limit: 10, q: "machine learning" });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /t\.title ILIKE \$1 ESCAPE '!'/i);
    assert.match(sql, /t\.abstract ILIKE \$1 ESCAPE '!'/i);
    assert.deepEqual(params, ["%machine learning%", 10]);
  });

  it("scopes the list to one uploader", async () => {
    await thesisModel.getAllTheses({ limit: 10, uploaderId: UPLOADER });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /t\.uploader_id = \$1::uuid/i);
    assert.deepEqual(params, [UPLOADER, 10]);
  });

  it("matches any category in the requested group", async () => {
    await thesisModel.getAllTheses({
      limit: 10,
      categories: ["Undergraduate Capstone", "Capstone"],
    });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /t\.category = ANY\(\$1::text\[\]\)/i);
    assert.deepEqual(params, [["Undergraduate Capstone", "Capstone"], 10]);
  });

  it("keeps cursor and filter parameter numbering aligned", async () => {
    await thesisModel.getAllTheses({
      limit: 5,
      cursor: CURSOR,
      q: "ai",
      uploaderId: UPLOADER,
      categories: ["Graduate Dissertation"],
    });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /t\.created_at < \$1::timestamptz/i);
    assert.match(sql, /t\.title ILIKE \$3 ESCAPE '!'/i);
    assert.match(sql, /t\.uploader_id = \$4::uuid/i);
    assert.match(sql, /t\.category = ANY\(\$5::text\[\]\)/i);
    assert.deepEqual(params, [
      "2026-10-20T00:00:00.000Z",
      "33333333-3333-4333-8333-333333333333",
      "%ai%",
      UPLOADER,
      ["Graduate Dissertation"],
      5,
    ]);
  });
});
