require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");
const { stub } = require("./stub.helper");

const query = stub(db, "query", async () => ({ rows: [] }));
const userModel = require("../models/userModel");

const DEPT = "33333333-3333-4333-8333-333333333333";
const CURSOR = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  query.calls.length = 0;
  query.setImpl(async () => ({ rows: [] }));
});

describe("user directory filters", () => {
  it("matches the search term against username and full name", async () => {
    await userModel.getAllUsers({ limit: 10, q: "jane" });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /p\.username ILIKE \$1 ESCAPE '!'/i);
    assert.match(sql, /p\.full_name ILIKE \$1 ESCAPE '!'/i);
    assert.match(sql, /d\.name ILIKE \$1 ESCAPE '!'/i);
    assert.deepEqual(params, ["%jane%", 10]);
  });

  it("scopes the directory to one department", async () => {
    await userModel.getAllUsers({ limit: 10, departmentId: DEPT });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /p\.department_id = \$1::uuid/i);
    assert.deepEqual(params, [DEPT, 10]);
  });

  it("filters by exact year level", async () => {
    await userModel.getAllUsers({ limit: 10, yearLevel: "3rd Year" });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /p\.year_level = \$1/i);
    assert.deepEqual(params, ["3rd Year", 10]);
  });

  it("keeps cursor and filter parameter numbering aligned", async () => {
    await userModel.getAllUsers({
      limit: 5,
      cursor: CURSOR,
      q: "jane",
      departmentId: DEPT,
      yearLevel: "3rd Year",
    });

    const [sql, params] = query.calls.at(-1);
    assert.match(sql, /p\.id > \$1/i);
    assert.match(sql, /p\.username ILIKE \$2 ESCAPE '!'/i);
    assert.match(sql, /p\.department_id = \$3::uuid/i);
    assert.match(sql, /p\.year_level = \$4/i);
    assert.deepEqual(params, [CURSOR, "%jane%", DEPT, "3rd Year", 5]);
  });
});
