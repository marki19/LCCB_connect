const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { stub } = require("./stub.helper");
const db = require("../db");
const accountService = require("../services/accountService");

describe("Concurrent Session Cap", () => {
  const USER_ID = "00000000-0000-0000-0000-000000000001";

  it("returns 0 evicted when user ID is invalid", async () => {
    const result = await accountService.enforceSessionCap("not-a-uuid");
    assert.deepEqual(result, { evicted: 0, sessionIds: [] });
  });

  it("leaves sessions alone when active sessions <= cap", async () => {
    const queries = [];
    const origQuery = db.query;
    db.query = async (sql, params) => {
      queries.push({ sql, params });
      // OFFSET cap returns empty rows
      return { rows: [], rowCount: 0 };
    };

    try {
      const result = await accountService.enforceSessionCap(USER_ID, { maxSessions: 5 });
      assert.deepEqual(result, { evicted: 0, sessionIds: [] });
      assert.equal(queries.length, 1);
      assert.equal(queries[0].params[1], 5);
    } finally {
      db.query = origQuery;
    }
  });

  it("evicts oldest sessions when count exceeds cap", async () => {
    const queries = [];
    const origQuery = db.query;
    const oldestSessions = [{ id: "sess-old-1" }, { id: "sess-old-2" }];

    db.query = async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes("SELECT id FROM auth.sessions")) {
        return { rows: oldestSessions, rowCount: 2 };
      }
      if (sql.includes("DELETE FROM auth.sessions")) {
        return { rowCount: 2 };
      }
      return { rowCount: 2 };
    };

    try {
      const result = await accountService.enforceSessionCap(USER_ID, { maxSessions: 3 });
      assert.equal(result.evicted, 2);
      assert.deepEqual(result.sessionIds, ["sess-old-1", "sess-old-2"]);

      // Verify queries executed: SELECT, DELETE refresh_tokens, DELETE sessions, INSERT session_events
      assert.equal(queries.length, 4);
      assert.ok(queries[0].sql.includes("OFFSET $2"));
      assert.ok(queries[1].sql.includes("DELETE FROM auth.refresh_tokens"));
      assert.ok(queries[2].sql.includes("DELETE FROM auth.sessions"));
      assert.ok(queries[3].sql.includes("INSERT INTO public.session_events"));
      assert.ok(queries[3].params[1].includes("session_cap_exceeded"));
    } finally {
      db.query = origQuery;
    }
  });

  it("applies stricter default cap of 3 for admin and superadmin roles", async () => {
    const queries = [];
    const origQuery = db.query;
    db.query = async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [], rowCount: 0 };
    };

    try {
      await accountService.enforceSessionCap(USER_ID, { role: "admin" });
      assert.equal(queries[0].params[1], 3);

      queries.length = 0;
      await accountService.enforceSessionCap(USER_ID, { role: "superadmin" });
      assert.equal(queries[0].params[1], 3);

      queries.length = 0;
      await accountService.enforceSessionCap(USER_ID, { role: "student" });
      assert.equal(queries[0].params[1], 5);
    } finally {
      db.query = origQuery;
    }
  });

  it("handles db query failure safely without throwing", async () => {
    const origQuery = db.query;
    db.query = async () => {
      throw new Error("DB connection timeout");
    };

    try {
      const result = await accountService.enforceSessionCap(USER_ID, { maxSessions: 5 });
      assert.deepEqual(result, { evicted: 0, sessionIds: [] });
    } finally {
      db.query = origQuery;
    }
  });
});

