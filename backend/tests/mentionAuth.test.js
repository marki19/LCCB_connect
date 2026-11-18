const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const db = require("../db");

describe("can_mention authorization rule", () => {
  let client;
  let deptA, deptB;
  const suffix = Math.floor(10000 + Math.random() * 90000);
  const uAuthor = `m_auth_${suffix}`;
  const uFriendOtherDept = `m_frnd_${suffix}`;
  const uSameDeptNonFriend = `m_same_${suffix}`;
  const uStrangerOtherDept = `m_strg_${suffix}`;
  const uGuest = `m_gst_${suffix}`;

  before(async () => {
    client = await db.pool.connect();
    await client.query("BEGIN");

    // Fetch or create two distinct departments
    const deptRes = await client.query("SELECT id FROM public.departments LIMIT 2");
    if (deptRes.rows.length >= 2) {
      deptA = deptRes.rows[0].id;
      deptB = deptRes.rows[1].id;
    } else {
      const insA = await client.query(
        "INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id",
        [`Dept A ${Date.now()}`, "DA"]
      );
      const insB = await client.query(
        "INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id",
        [`Dept B ${Date.now()}`, "DB"]
      );
      deptA = insA.rows[0].id;
      deptB = insB.rows[0].id;
    }

    // Insert test profiles
    // 1. Author (Dept A, student)
    await client.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role)
       VALUES ($1, $2, 'Author', $3, 'student')`,
      [uAuthor, `${uAuthor}_u`, deptA]
    );

    // 2. Friend in Dept B
    await client.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role)
       VALUES ($1, $2, 'Friend Other Dept', $3, 'student')`,
      [uFriendOtherDept, `${uFriendOtherDept}_u`, deptB]
    );

    // 3. Accepted friendship between Author and FriendOtherDept
    await client.query(
      `INSERT INTO public.friendships (requester_id, addressee_id, status)
       VALUES ($1, $2, 'accepted')`,
      [uAuthor, uFriendOtherDept]
    );

    // 4. Same Dept Non-friend (Dept A, student)
    await client.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role)
       VALUES ($1, $2, 'Same Dept Non-friend', $3, 'student')`,
      [uSameDeptNonFriend, `${uSameDeptNonFriend}_u`, deptA]
    );

    // 5. Stranger in Dept B (not friend)
    await client.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role)
       VALUES ($1, $2, 'Stranger Other Dept', $3, 'student')`,
      [uStrangerOtherDept, `${uStrangerOtherDept}_u`, deptB]
    );

    // 6. Guest user (even in same dept)
    await client.query(
      `INSERT INTO public.profiles (id, username, full_name, department_id, role)
       VALUES ($1, $2, 'Guest User', $3, 'guest')`,
      [uGuest, `${uGuest}_u`, deptA]
    );
  });

  after(async () => {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    await db.pool.end();
  });

  it("allows friends across different departments to mention each other", async () => {
    const res = await client.query("SELECT public.can_mention($1, $2) AS allowed", [
      uAuthor,
      uFriendOtherDept,
    ]);
    assert.equal(res.rows[0].allowed, true);
  });

  it("allows classmates in the same department to mention each other without being friends", async () => {
    const res = await client.query("SELECT public.can_mention($1, $2) AS allowed", [
      uAuthor,
      uSameDeptNonFriend,
    ]);
    assert.equal(res.rows[0].allowed, true);
  });

  it("disallows strangers in different departments from mentioning each other", async () => {
    const res = await client.query("SELECT public.can_mention($1, $2) AS allowed", [
      uAuthor,
      uStrangerOtherDept,
    ]);
    assert.equal(res.rows[0].allowed, false);
  });

  it("disallows mentioning a guest user", async () => {
    const res = await client.query("SELECT public.can_mention($1, $2) AS allowed", [
      uAuthor,
      uGuest,
    ]);
    assert.equal(res.rows[0].allowed, false);
  });

  it("disallows mentioning yourself", async () => {
    const res = await client.query("SELECT public.can_mention($1, $2) AS allowed", [
      uAuthor,
      uAuthor,
    ]);
    assert.equal(res.rows[0].allowed, false);
  });
});
