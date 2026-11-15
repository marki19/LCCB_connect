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
  it("reads the list through visible_theses with the viewer id", async () => {
    await thesisModel.getAllTheses({ limit: 10, viewerId: "u1" });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /FROM visible_theses\(\$1::text\) t/i);
    assert.deepEqual(params, ["u1", 10]);
  });

  it("passes a null viewer for guests", async () => {
    await thesisModel.getAllTheses({ limit: 10 });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /FROM visible_theses\(\$1::text\) t/i);
    assert.equal(params[0], null);
  });

  it("keeps the visibility gate when a cursor is present", async () => {
    const cursor = "2026-10-20T00:00:00.000Z|11111111-1111-4111-8111-111111111111";
    await thesisModel.getAllTheses({ limit: 10, cursor, viewerId: "u1" });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /FROM visible_theses\(\$3::text\) t/i);
    assert.deepEqual(params, [
      "2026-10-20T00:00:00.000Z",
      "11111111-1111-4111-8111-111111111111",
      "u1",
      10,
    ]);
  });

  it("gates the detail read through visible_theses", async () => {
    await thesisModel.getThesisById("11111111-1111-4111-8111-111111111111", {
      viewerId: "u1",
    });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /FROM visible_theses\(\$2::text\) t/i);
    assert.deepEqual(params, ["11111111-1111-4111-8111-111111111111", "u1"]);
  });

  it("reads the base table for moderation", async () => {
    await thesisModel.getAllTheses({ limit: 10, includeHidden: true });
    let [sql] = query.calls.at(-1);
    assert.match(sql, /FROM theses t/i);
    assert.doesNotMatch(sql, /visible_theses/i);

    await thesisModel.getThesisById("11111111-1111-4111-8111-111111111111", {
      includeHidden: true,
    });
    [sql] = query.calls.at(-1);
    assert.match(sql, /FROM theses t/i);
    assert.doesNotMatch(sql, /visible_theses/i);
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
    assert.match(sql, /pr\.full_name ILIKE \$1 ESCAPE '!'/i);
    assert.match(sql, /d\.name ILIKE \$1 ESCAPE '!'/i);
    assert.deepEqual(params, ["%machine learning%", null, 10]);
  });

  it("scopes the list to one uploader", async () => {
    await thesisModel.getAllTheses({ limit: 10, uploaderId: UPLOADER });

    const [sql, params] = query.calls.at(-1);
    // uploader_id is TEXT in the schema, so the cast must be ::text.
    assert.match(sql, /t\.uploader_id = \$1::text/i);
    assert.deepEqual(params, [UPLOADER, null, 10]);
  });

  it("matches any category in the requested group", async () => {
    await thesisModel.getAllTheses({
      limit: 10,
      categories: ["Undergraduate Capstone", "Capstone"],
    });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /t\.category = ANY\(\$1::text\[\]\)/i);
    assert.deepEqual(params, [["Undergraduate Capstone", "Capstone"], null, 10]);
  });

  it("keeps cursor and filter parameter numbering aligned", async () => {
    await thesisModel.getAllTheses({
      limit: 5,
      cursor: CURSOR,
      q: "ai",
      uploaderId: UPLOADER,
      categories: ["Graduate Dissertation"],
      viewerId: "u1",
    });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /t\.created_at < \$1::timestamptz/i);
    assert.match(sql, /t\.title ILIKE \$3 ESCAPE '!'/i);
    assert.match(sql, /t\.uploader_id = \$4::text/i);
    assert.match(sql, /t\.category = ANY\(\$5::text\[\]\)/i);
    assert.match(sql, /FROM visible_theses\(\$6::text\) t/i);
    assert.match(sql, /LIMIT \$7/i);
    assert.deepEqual(params, [
      "2026-10-20T00:00:00.000Z",
      "33333333-3333-4333-8333-333333333333",
      "%ai%",
      UPLOADER,
      ["Graduate Dissertation"],
      "u1",
      5,
    ]);
  });
});
