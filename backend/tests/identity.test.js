const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeHandle, deriveBaseUsername, deriveUsername } = require("../services/identity");

describe("identityService.sanitizeHandle", () => {
  it("lowercases, removes diacritics, and strips invalid characters", () => {
    assert.equal(sanitizeHandle("JOSÉ Dela Cruz!"), "josedelacruz");
    assert.equal(sanitizeHandle("mark.antipo"), "mark.antipo");
    assert.equal(sanitizeHandle("user...name"), "user.name");
    assert.equal(sanitizeHandle(".user.name."), "user.name");
  });
});

describe("identityService.deriveBaseUsername", () => {
  it("formats single, double, and compound names", () => {
    assert.equal(deriveBaseUsername("Mark Antipo", "u1"), "mark.antipo");
    assert.equal(deriveBaseUsername("Julian Gemelo", "u2"), "julian.gemelo");
    assert.equal(deriveBaseUsername("Juan Dela Cruz", "u3"), "juan.delacruz");
    assert.equal(deriveBaseUsername("Antipo", "u4"), "antipo");
  });

  it("falls back to student + id suffix when name is missing or too short", () => {
    assert.equal(deriveBaseUsername("", "25247621-31ce-4f85-aea5-356954662345"), "student662345");
    assert.equal(deriveBaseUsername(null, "stu_loz8dryp"), "studentz8dryp");
    assert.equal(deriveBaseUsername("ab", "stu_123456"), "student123456");
  });

  it("truncates names longer than 30 characters", () => {
    const longName = "A Very Long First Name And An Extremely Long Surname";
    const base = deriveBaseUsername(longName, "u1");
    assert.ok(base.length <= 30);
  });
});

describe("identityService.deriveUsername collision handling", () => {
  it("returns base handle if not in use", async () => {
    const mockDb = {
      query: async () => ({ rows: [] }),
    };
    const username = await deriveUsername("Mark Antipo", "u1", mockDb);
    assert.equal(username, "mark.antipo");
  });

  it("suffixes _2, _3 on collision", async () => {
    let callCount = 0;
    const mockDb = {
      query: async (sql, params) => {
        callCount++;
        // Simulate "juan.delacruz" exists, "juan.delacruz_2" is free
        if (params[0] === "juan.delacruz") {
          return { rows: [{ id: "other_user" }] };
        }
        return { rows: [] };
      },
    };

    const username = await deriveUsername("Juan Dela Cruz", "u2", mockDb);
    assert.equal(username, "juan.delacruz_2");
    assert.equal(callCount, 2);
  });

  it("guarantees candidate with suffix does not exceed 30 chars", async () => {
    const longName = "Christopher Alexander Montgomery";
    const mockDb = {
      query: async (sql, params) => {
        if (!params[0].includes("_2")) {
          return { rows: [{ id: "other" }] };
        }
        return { rows: [] };
      },
    };
    const username = await deriveUsername(longName, "u1", mockDb);
    assert.ok(username.endsWith("_2"));
    assert.ok(username.length <= 30);
  });
});

describe("userModel.updateUser permanent identity", () => {
  it("omits username and full_name from SQL SET clause", async () => {
    const db = require("../db");
    const userModel = require("../models/userModel");
    const originalQuery = db.query;
    let querySql = "";

    db.query = async (sql, params) => {
      querySql = sql;
      return { rows: [{ id: "u1", full_name: "Original", username: "original" }] };
    };

    try {
      await userModel.updateUser("u1", {
        full_name: "Hacked Name",
        username: "hacked.username",
        bio: "Updated bio",
      });

      assert.ok(!querySql.includes("full_name ="), "SQL SET must never update full_name");
      assert.ok(!querySql.includes("username ="), "SQL SET must never update username");
      assert.ok(querySql.includes("bio = COALESCE($2, bio)"));
    } finally {
      db.query = originalQuery;
    }
  });
});
