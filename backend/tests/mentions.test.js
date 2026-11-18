require("./env.helper");

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const mentions = require("../services/mentions");
const postController = require("../controllers/postController");
const postModel = require("../models/postModel");

function mockResponse() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

describe("mentions service and post/comment integration", () => {
  let deptA, deptB;
  let createdDeptB = false;
  const suffix = Math.floor(10000 + Math.random() * 90000);
  const uAuthor = `m_svc_a_${suffix}`;
  const uFriendOtherDept = `m_svc_f_${suffix}`;
  const uSameDeptNonFriend = `m_svc_s_${suffix}`;
  const uStrangerOtherDept = `m_svc_x_${suffix}`;
  const uGuest = `m_svc_g_${suffix}`;

  let testPostId;
  const createdPostIds = [];

  before(async () => {
    // Fetch existing department(s) or create
    const deptRes = await db.query("SELECT id FROM public.departments LIMIT 2");
    if (deptRes.rows.length >= 2) {
      deptA = deptRes.rows[0].id;
      deptB = deptRes.rows[1].id;
    } else {
      deptA = deptRes.rows[0]?.id;
      if (!deptA) {
        const insA = await db.query(
          "INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id",
          [`Dept A ${suffix}`, `A${suffix.toString().slice(-4)}`]
        );
        deptA = insA.rows[0].id;
      }
      const insB = await db.query(
        "INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id",
        [`Dept B ${suffix}`, `B${suffix.toString().slice(-4)}`]
      );
      deptB = insB.rows[0].id;
      createdDeptB = true;
    }

    // Insert profiles
    await db.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role, course, student_id)
       VALUES ($1, $2, 'Author User', $3, 'student', 'BSCS', 'ID_' || $1)`,
      [uAuthor, `${uAuthor}_u`, deptA]
    );

    await db.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role, course, student_id)
       VALUES ($1, $2, 'Friend Other Dept', $3, 'student', 'BSCS', 'ID_' || $1)`,
      [uFriendOtherDept, `${uFriendOtherDept}_u`, deptB]
    );

    await db.query(
      `INSERT INTO public.friendships (requester_id, addressee_id, status)
       VALUES ($1, $2, 'accepted')`,
      [uAuthor, uFriendOtherDept]
    );

    await db.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role, course, student_id)
       VALUES ($1, $2, 'Same Dept Classmate', $3, 'student', 'BSCS', 'ID_' || $1)`,
      [uSameDeptNonFriend, `${uSameDeptNonFriend}_u`, deptA]
    );

    await db.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role, course, student_id)
       VALUES ($1, $2, 'Stranger Other Dept', $3, 'student', 'BSCS', 'ID_' || $1)`,
      [uStrangerOtherDept, `${uStrangerOtherDept}_u`, deptB]
    );

    await db.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role, course, student_id)
       VALUES ($1, $2, 'Guest User', $3, 'guest', 'BSCS', 'ID_' || $1)`,
      [uGuest, `${uGuest}_u`, deptA]
    );

    const postRes = await db.query(
      `INSERT INTO public.posts (author_id, content, visibility, kind)
       VALUES ($1, 'Test mentions post', 'public', 'discussion')
       RETURNING id`,
      [uAuthor]
    );
    testPostId = postRes.rows[0].id;
    createdPostIds.push(testPostId);
  });

  after(async () => {
    const allUsers = [uAuthor, uFriendOtherDept, uSameDeptNonFriend, uStrangerOtherDept, uGuest];
    try {
      if (createdPostIds.length > 0) {
        await db.query(`DELETE FROM public.posts WHERE id = ANY($1::uuid[])`, [createdPostIds]);
      }
      await db.query(`DELETE FROM public.posts WHERE author_id = ANY($1::text[])`, [allUsers]);
      await db.query(`DELETE FROM public.friendships WHERE requester_id = ANY($1::text[]) OR addressee_id = ANY($1::text[])`, [allUsers]);
      await db.query(`DELETE FROM public.profiles WHERE id = ANY($1::text[])`, [allUsers]);
      if (createdDeptB) {
        await db.query(`DELETE FROM public.departments WHERE id = $1`, [deptB]);
      }
    } finally {
      await db.pool.end();
    }
  });

  it("extractTokens parses @handle while ignoring email addresses", () => {
    const text = "Hey @alice and @bob_123, check test@example.com and @carol.456!";
    const tokens = mentions.extractTokens(text);
    assert.deepEqual(tokens.sort(), ["alice", "bob_123", "carol.456"].sort());
  });

  it("getMentionableUsers returns friends and same-department classmates, excluding strangers/guests/self", async () => {
    const list = await mentions.getMentionableUsers(uAuthor, "", 10);
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
      { visibility: "public" }
    );

    assert.ok(res.allowed.includes(uFriendOtherDept), "friend is allowed on public post");
    assert.ok(res.rejected.includes(uSameDeptNonFriend), "same-dept non-friend is rejected on public post");
  });

  it("resolveMentionIds allows same-dept non-friends on department visibility", async () => {
    const res = await mentions.resolveMentionIds(
      uAuthor,
      `Hello @${uFriendOtherDept}_u and @${uSameDeptNonFriend}_u`,
      [],
      { visibility: "department" }
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
      { visibility: "department" }
    );

    assert.ok(res.rejected.includes(uAuthor), "self rejected");
    assert.ok(res.rejected.includes(uGuest), "guest rejected");
    assert.ok(res.rejected.includes(uStrangerOtherDept), "stranger rejected");
  });

  it("replacePostMentions inserts and updates post mentions", async () => {
    await mentions.replacePostMentions(testPostId, null, [uFriendOtherDept]);

    const check1 = await db.query(
      `SELECT mentioned_user_id FROM public.post_mentions WHERE post_id = $1`,
      [testPostId]
    );
    assert.deepEqual(check1.rows.map((r) => r.mentioned_user_id), [uFriendOtherDept]);

    // Replace with empty
    await mentions.replacePostMentions(testPostId, null, []);
    const check2 = await db.query(
      `SELECT mentioned_user_id FROM public.post_mentions WHERE post_id = $1`,
      [testPostId]
    );
    assert.equal(check2.rows.length, 0);
  });

  it("a post mentioning a stranger returns 400 mention_not_allowed", async () => {
    const req = {
      user: { id: uAuthor },
      profile: { role: "student", profile_completed: true, department_id: deptA },
      body: {
        content: `Hey stranger @${uStrangerOtherDept}_u`,
        visibility: "public",
        kind: "discussion",
      },
    };
    const res = mockResponse();
    await postController.createPost(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "mention_not_allowed");
    assert.ok(res.body.rejected.includes(uStrangerOtherDept));
  });

  it("a post mentioning a friend in another department succeeds", async () => {
    const req = {
      user: { id: uAuthor },
      profile: { role: "student", profile_completed: true, department_id: deptA },
      body: {
        content: `Hey friend @${uFriendOtherDept}_u`,
        visibility: "public",
        kind: "discussion",
      },
    };
    const res = mockResponse();
    let errOccurred;
    await postController.createPost(req, res, (err) => { errOccurred = err; });
    if (errOccurred) throw errOccurred;
    assert.equal(res.statusCode, 201);
    createdPostIds.push(res.body.id);
    assert.ok(Array.isArray(res.body.mentions));
    assert.ok(res.body.mentions.some((m) => m.user_id === uFriendOtherDept));
  });

  it("a public post cannot mention a same-department non-friend", async () => {
    const req = {
      user: { id: uAuthor },
      profile: { role: "student", profile_completed: true, department_id: deptA },
      body: {
        content: `Public callout @${uSameDeptNonFriend}_u`,
        visibility: "public",
        kind: "discussion",
      },
    };
    const res = mockResponse();
    await postController.createPost(req, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "mention_not_allowed");
    assert.ok(res.body.rejected.includes(uSameDeptNonFriend));
  });

  it("a department post can mention a same-department non-friend", async () => {
    const req = {
      user: { id: uAuthor },
      profile: { role: "student", profile_completed: true, department_id: deptA },
      body: {
        content: `Dept update @${uSameDeptNonFriend}_u`,
        visibility: "department",
        kind: "discussion",
      },
    };
    const res = mockResponse();
    let errOccurred;
    await postController.createPost(req, res, (err) => { errOccurred = err; });
    if (errOccurred) throw errOccurred;
    assert.equal(res.statusCode, 201);
    createdPostIds.push(res.body.id);
    assert.ok(Array.isArray(res.body.mentions));
    assert.ok(res.body.mentions.some((m) => m.user_id === uSameDeptNonFriend));
  });

  it("a comment mention is stored with comment_id", async () => {
    // Create a department post first
    const post = await postModel.createPost({
      author_id: uAuthor,
      content: "Post for comment mentions",
      visibility: "department",
      kind: "discussion",
    });
    createdPostIds.push(post.id);

    const req = {
      user: { id: uAuthor },
      profile: { role: "student", profile_completed: true, department_id: deptA },
      params: { id: post.id },
      body: {
        content: `Nice work @${uSameDeptNonFriend}_u`,
      },
    };
    const res = mockResponse();
    await postController.addComment(req, res, () => {});
    assert.equal(res.statusCode, 201);

    const mentionsRes = await db.query(
      `SELECT post_id, comment_id, mentioned_user_id FROM public.post_mentions WHERE comment_id = $1`,
      [res.body.id]
    );
    assert.equal(mentionsRes.rows.length, 1);
    assert.equal(mentionsRes.rows[0].mentioned_user_id, uSameDeptNonFriend);
  });

  it("deleting a post removes its mentions", async () => {
    const post = await postModel.createPost({
      author_id: uAuthor,
      content: "Post to delete",
      visibility: "department",
      kind: "discussion",
      mentions: [uFriendOtherDept],
    });

    const checkBefore = await db.query(
      `SELECT count(*)::int AS count FROM public.post_mentions WHERE post_id = $1`,
      [post.id]
    );
    assert.equal(checkBefore.rows[0].count, 1);

    await db.query(`DELETE FROM public.posts WHERE id = $1`, [post.id]);

    const checkAfter = await db.query(
      `SELECT count(*)::int AS count FROM public.post_mentions WHERE post_id = $1`,
      [post.id]
    );
    assert.equal(checkAfter.rows[0].count, 0);
  });

  it("creates mention notifications for mentioned friends on post creation", async () => {
    const req = {
      user: { id: uAuthor },
      profile: { role: "student", profile_completed: true, department_id: deptA },
      body: {
        content: `Hey @${uFriendOtherDept}_u check this out!`,
        visibility: "public",
        kind: "discussion",
      },
    };
    const res = mockResponse();
    let errOccurred;
    await postController.createPost(req, res, (err) => { errOccurred = err; });
    if (errOccurred) throw errOccurred;
    assert.equal(res.statusCode, 201);
    createdPostIds.push(res.body.id);

    const notifRes = await db.query(
      `SELECT user_id, actor_id, type, message FROM public.notifications WHERE target_id = $1`,
      [res.body.id]
    );
    const mentionNotif = notifRes.rows.find((n) => n.type === "mention");
    assert.ok(mentionNotif, "mention notification was created");
    assert.equal(mentionNotif.user_id, uFriendOtherDept);
    assert.equal(mentionNotif.actor_id, uAuthor);
    assert.equal(mentionNotif.message, `@${uAuthor}_u mentioned you.`);
  });
});
