require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");
const { stub } = require("./stub.helper");

const query = stub(db, "query", async () => ({ rows: [] }));
const notificationService = require("../services/notificationService");

beforeEach(() => {
  query.calls.length = 0;
  query.setImpl(async () => ({ rows: [] }));
});

describe("notificationService", () => {
  describe("createNotifications", () => {
    it("inserts notifications in a single bulk query with unnest", async () => {
      const adminIds = [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ];

      await notificationService.createNotifications(adminIds, {
        actorId: "44444444-4444-4444-8444-444444444444",
        type: "post_created",
        targetId: "55555555-5555-4555-8555-555555555555",
        departmentId: "66666666-6666-4666-8666-666666666666",
        departmentName: "College of Information Technology",
        message: "A new post was published",
      });

      // Exactly ONE query executed instead of 3 sequential INSERTs
      assert.equal(query.calls.length, 1);
      const [sql, params] = query.calls[0];
      assert.match(sql, /INSERT INTO public\.notifications/i);
      assert.match(sql, /SELECT unnest\(\$1::text\[\]\)/i);
      assert.deepEqual(params[0], adminIds);
      assert.equal(params[1], "44444444-4444-4444-8444-444444444444");
      assert.equal(params[2], "post_created");
      assert.equal(params[3], "55555555-5555-4555-8555-555555555555");
      assert.equal(params[4], "66666666-6666-4666-8666-666666666666");
      assert.equal(params[5], "College of Information Technology");
      assert.equal(params[6], "A new post was published");
    });

    it("does not execute a query when adminIds is empty", async () => {
      await notificationService.createNotifications([], {
        type: "post_created",
        message: "Empty",
      });
      assert.equal(query.calls.length, 0);
    });
  });

  describe("getTargetAdmins", () => {
    it("queries campus admins and department admins through normalize_role", async () => {
      const deptId = "66666666-6666-4666-8666-666666666666";
      await notificationService.getTargetAdmins(deptId);

      assert.equal(query.calls.length, 1);
      const [sql, params] = query.calls[0];
      // Role is stored mixed-case ('superAdmin' as well as 'superadmin'), so an
      // exact match would silently drop camelCase admins.
      assert.match(sql, /normalize_role\(role\) IN \('admin', 'superadmin'\)/i);
      assert.match(sql, /normalize_role\(role\) = 'departmentadmin'/i);
      assert.match(sql, /department_id = \$1::uuid/i);
      assert.deepEqual(params, [deptId]);
    });

    it("handles null departmentId gracefully", async () => {
      await notificationService.getTargetAdmins(null);

      assert.equal(query.calls.length, 1);
      const [sql, params] = query.calls[0];
      assert.match(sql, /department_id = \$1::uuid/i);
      assert.deepEqual(params, [null]);
    });
  });

  describe("notifyMentionedUsers", () => {
    it("inserts mention notifications for valid mentioned users, skipping the actor", async () => {
      await notificationService.notifyMentionedUsers({
        mentionedUserIds: ["u_friend1", "u_friend2", "u_author"],
        actorId: "u_author",
        actorUsername: "alice",
        targetId: "55555555-5555-4555-8555-555555555555",
      });

      assert.equal(query.calls.length, 1);
      const [sql, params] = query.calls[0];
      assert.match(sql, /INSERT INTO public\.notifications/i);
      assert.match(sql, /unnest\(\$1::text\[\]\)/i);
      assert.deepEqual(params[0].sort(), ["u_friend1", "u_friend2"].sort());
      assert.equal(params[1], "u_author");
      assert.equal(params[2], "55555555-5555-4555-8555-555555555555");
      assert.equal(params[3], "@alice mentioned you.");
    });

    it("does not execute query if no valid mentioned users", async () => {
      await notificationService.notifyMentionedUsers({
        mentionedUserIds: ["u_author"],
        actorId: "u_author",
        actorUsername: "alice",
        targetId: "55555555-5555-4555-8555-555555555555",
      });
      assert.equal(query.calls.length, 0);
    });
  });
});

