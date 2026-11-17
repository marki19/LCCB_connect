const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const db = require("../db");
const mentions = require("../services/mentions");

describe("mentions service", () => {
  let client;
  let deptA, deptB;
  const suffix = Math.floor(10000 + Math.random() * 90000);
  const uAuthor = `m_svc_a_${suffix}`;
  const uFriendOtherDept = `m_svc_f_${suffix}`;
  const uSameDeptNonFriend = `m_svc_s_${suffix}`;
  const uStrangerOtherDept = `m_svc_x_${suffix}`;
  const uGuest = `m_svc_g_${suffix}`;

  let testPostId;

  before(async () => {
    client = await db.pool.connect();
    await client.query("BEGIN");

    // Fetch existing department(s) or create
    const deptRes = await client.query("SELECT id FROM public.departments LIMIT 2");
    if (deptRes.rows.length >= 2) {
      deptA = deptRes.rows[0].id;
      deptB = deptRes.rows[1].id;
    } else {
      deptA = deptRes.rows[0]?.id;
      if (!deptA) {
        const insA = await client.query(
          "INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id",
          [`Dept A ${suffix}`, `A${suffix.toString().slice(-4)}`]
        );
        deptA = insA.rows[0].id;
      }
      const insB = await client.query(
        "INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id",
        [`Dept B ${suffix}`, `B${suffix.toString().slice(-4)}`]
      );
      deptB = insB.rows[0].id;
    }

    // Insert profiles
    await client.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role)
       VALUES ($1, $2, 'Author User', $3, 'student')`,
      [uAuthor, `${uAuthor}_u`, deptA]
    );

    await client.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role)
       VALUES ($1, $2, 'Friend Other Dept', $3, 'student')`,
      [uFriendOtherDept, `${uFriendOtherDept}_u`, deptB]
    );

    await client.query(
      `INSERT INTO public.friendships (requester_id, addressee_id, status)
       VALUES ($1, $2, 'accepted')`,
      [uAuthor, uFriendOtherDept]
    );

    await client.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role)
       VALUES ($1, $2, 'Same Dept Classmate', $3, 'student')`,
      [uSameDeptNonFriend, `${uSameDeptNonFriend}_u`, deptA]
    );

    await client.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role)
       VALUES ($1, $2, 'Stranger Other Dept', $3, 'student')`,
      [uStrangerOtherDept, `${uStrangerOtherDept}_u`, deptB]
    );

    await client.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role)
       VALUES ($1, $2, 'Guest User', $3, 'guest')`,
      [uGuest, `${uGuest}_u`, deptA]
    );

    const postRes = await client.query(
      `INSERT INTO public.posts (author_id, content, visibility, kind)
       VALUES ($1, 'Test mentions post', 'public', 'discussion')
       RETURNING id`,
      [uAuthor]
    );
    testPostId = postRes.rows[0].id;
  });

  after(async () => {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    await db.pool.end();
  });

  it("extractTokens parses @handle while ignoring email addresses", () => {
    const text = "Hey @alice and @bob_123, check test@example.com and @carol.456!";
    const tokens = mentions.extractTokens(text);
    assert.deepEqual(tokens.sort(), ["alice", "bob_123", "carol.456"].sort());
  });

  it("getMentionableUsers returns friends and same-department classmates, excluding strangers/guests/self", async () => {
    const list = await mentions.getMentionableUsers(uAuthor, "", 10, client);
    const ids = list.map((u) => u.id);

    assert.ok(ids.includes(uFriendOtherDept), "includes friend in other dept");
    assert.ok(ids.includes(uSameDeptNonFriend), "includes classmate in same dept");
    assert.ok(!ids.includes(uStrangerOtherDept), "excludes stranger in other dept");
    assert.ok(!ids.includes(uGuest), "excludes guest");
    assert.ok(!ids.includes(uAuthor), "excludes author");
  });

  it("resolveMentionIds enforces that public visibility allows friends only", async () => {
    const res = await mentions.resolveMentionIds(
      uAuthor,
      `Hello @${uFriendOtherDept}_u and @${uSameDeptNonFriend}_u`,
      [],
      { visibility: "public" },
      client
    );

    assert.ok(res.allowed.includes(uFriendOtherDept), "friend is allowed on public post");
    assert.ok(res.rejected.includes(uSameDeptNonFriend), "same-dept non-friend is rejected on public post");
  });

  it("resolveMentionIds allows same-dept non-friends on department visibility", async () => {
    const res = await mentions.resolveMentionIds(
      uAuthor,
      `Hello @${uFriendOtherDept}_u and @${uSameDeptNonFriend}_u`,
      [],
      { visibility: "department" },
      client
    );

    assert.ok(res.allowed.includes(uFriendOtherDept), "friend is allowed on department post");
    assert.ok(res.allowed.includes(uSameDeptNonFriend), "same-dept classmate is allowed on department post");
    assert.equal(res.rejected.length, 0);
  });

  it("resolveMentionIds rejects self, guests, and strangers", async () => {
    const res = await mentions.resolveMentionIds(
      uAuthor,
      `@${uAuthor}_u @${uGuest}_u @${uStrangerOtherDept}_u`,
      [],
      { visibility: "department" },
      client
    );

    assert.ok(res.rejected.includes(uAuthor), "self rejected");
    assert.ok(res.rejected.includes(uGuest), "guest rejected");
    assert.ok(res.rejected.includes(uStrangerOtherDept), "stranger rejected");
  });

  it("replacePostMentions inserts and updates post mentions", async () => {
    await mentions.replacePostMentions(testPostId, null, [uFriendOtherDept], client);

    const check1 = await client.query(
      `SELECT mentioned_user_id FROM public.post_mentions WHERE post_id = $1`,
      [testPostId]
    );
    assert.deepEqual(check1.rows.map((r) => r.mentioned_user_id), [uFriendOtherDept]);

    // Replace with empty
    await mentions.replacePostMentions(testPostId, null, [], client);
    const check2 = await client.query(
      `SELECT mentioned_user_id FROM public.post_mentions WHERE post_id = $1`,
      [testPostId]
    );
    assert.equal(check2.rows.length, 0);
  });

  it("userController.getMentionableUsers returns { users }", async () => {
    const userController = require("../controllers/userController");
    const orig = mentions.getMentionableUsers;
    mentions.getMentionableUsers = async (authorId, q, limit) => [
      { id: "u2", username: "bob", full_name: "Bob", avatar_url: null },
    ];
    try {
      let resultPayload;
      const req = { user: { id: "u1" }, query: { q: "bo" } };
      const res = {
        json: (data) => {
          resultPayload = data;
        },
      };
      await userController.getMentionableUsers(req, res, () => {});
      assert.deepEqual(resultPayload, {
        users: [{ id: "u2", username: "bob", full_name: "Bob", avatar_url: null }],
      });
    } finally {
      mentions.getMentionableUsers = orig;
    }
  });
});
