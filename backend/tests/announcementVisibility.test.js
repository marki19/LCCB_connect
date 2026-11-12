// Announcement audience visibility (041_announcement_posts.sql).
//
// The audience rule lives in `visible_posts()`, so this is the one test that has
// to talk to Postgres. Everything runs inside a transaction that is rolled back,
// so no fixture survives the run and no real row is ever touched.
require("./env.helper");

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");

let client;

// Profiles
const ADMIN = "test-announcement-admin";
const STUDENT_A = "test-announcement-student-a";
const STUDENT_B = "test-announcement-student-b";
const FACULTY_A = "test-announcement-faculty-a";

// Catalog
let DEPT_A;
let DEPT_B;
let COURSE_A;

// Announcement ids, filled in `before`
const IDS = {};

const idsFor = async (viewer) => {
  const result = await client.query(
    `SELECT v.id
       FROM public.visible_posts($1::text) v
      WHERE v.type = 'announcement'
        AND v.author_id = $2;`,
    [viewer, ADMIN]
  );
  return result.rows.map((r) => r.id);
};

const sees = async (viewer, id) => (await idsFor(viewer)).includes(id);

before(async () => {
  client = await db.pool.connect();
  await client.query("BEGIN");

  const dept = await client.query(
    `INSERT INTO public.departments (name) VALUES ('ZZ Test Dept A'), ('ZZ Test Dept B')
     RETURNING id, name;`
  );
  DEPT_A = dept.rows.find((r) => r.name === "ZZ Test Dept A").id;
  DEPT_B = dept.rows.find((r) => r.name === "ZZ Test Dept B").id;

  COURSE_A = (
    await client.query(
      `INSERT INTO public.courses (department_id, name)
       VALUES ($1, 'ZZ Test Course A') RETURNING id;`,
      [DEPT_A]
    )
  ).rows[0].id;

  await client.query(
    `INSERT INTO public.profiles (id, username, full_name, role, department_id, course_id, year_level)
     VALUES
       ($1, 'zz_admin',     'ZZ Admin',     'admin',           NULL,    NULL,     NULL),
       ($2, 'zz_student_a', 'ZZ Student A', 'student',         $5,      $7,       '3rd Year'),
       ($3, 'zz_student_b', 'ZZ Student B', 'student',         $6,      NULL,     '2nd Year'),
       ($4, 'zz_faculty_a', 'ZZ Faculty A', 'faculty',         $5,      NULL,     NULL);`,
    [ADMIN, STUDENT_A, STUDENT_B, FACULTY_A, DEPT_A, DEPT_B, COURSE_A]
  );

  const insert = async (title, columns) => {
    const result = await client.query(
      `INSERT INTO public.posts (
         author_id, content, type, title, visibility,
         audience_role, audience_department_id, audience_course_id,
         audience_year_level, expires_at
       )
       VALUES ($1, 'body', 'announcement', $2, 'announcement', $3, $4, $5, $6, $7)
       RETURNING id;`,
      [
        ADMIN,
        title,
        columns.audience_role ?? null,
        columns.audience_department_id ?? null,
        columns.audience_course_id ?? null,
        columns.audience_year_level ?? null,
        columns.expires_at ?? null,
      ]
    );
    return result.rows[0].id;
  };

  IDS.everyone = await insert("Everyone", {});
  IDS.faculty = await insert("Faculty", { audience_role: "faculty" });
  IDS.deptA = await insert("Dept A", { audience_department_id: DEPT_A });
  IDS.courseA = await insert("Course A", { audience_course_id: COURSE_A });
  IDS.thirdYear = await insert("Third year", { audience_year_level: "3rd Year" });
  IDS.deptAThirdYear = await insert("Dept A third year", {
    audience_department_id: DEPT_A,
    audience_year_level: "3rd Year",
  });
  IDS.expired = await insert("Expired", { expires_at: "2020-01-01T00:00:00Z" });
});

after(async () => {
  await client.query("ROLLBACK");
  client.release();
  await db.pool.end();
});

describe("announcement audience", () => {
  it("an unconstrained announcement reaches everyone", async () => {
    for (const viewer of [STUDENT_A, STUDENT_B, FACULTY_A]) {
      assert.equal(await sees(viewer, IDS.everyone), true, viewer);
    }
  });

  it("a role audience reaches only that role", async () => {
    assert.equal(await sees(FACULTY_A, IDS.faculty), true);
    assert.equal(await sees(STUDENT_A, IDS.faculty), false);
  });

  it("a department audience stays inside the department", async () => {
    assert.equal(await sees(STUDENT_A, IDS.deptA), true);
    assert.equal(await sees(FACULTY_A, IDS.deptA), true);
    assert.equal(await sees(STUDENT_B, IDS.deptA), false);
  });

  it("a course audience reaches only that course", async () => {
    assert.equal(await sees(STUDENT_A, IDS.courseA), true);
    assert.equal(await sees(STUDENT_B, IDS.courseA), false);
    assert.equal(await sees(FACULTY_A, IDS.courseA), false);
  });

  it("a year-level audience reaches only that year", async () => {
    assert.equal(await sees(STUDENT_A, IDS.thirdYear), true);
    assert.equal(await sees(STUDENT_B, IDS.thirdYear), false);
  });

  it("combined constraints must all match", async () => {
    assert.equal(await sees(STUDENT_A, IDS.deptAThirdYear), true);
    assert.equal(await sees(STUDENT_B, IDS.deptAThirdYear), false);
  });

  it("an expired announcement drops out of the feed", async () => {
    assert.equal(await sees(STUDENT_A, IDS.expired), false);
  });

  it("the author always sees their own announcement, expired or not", async () => {
    const seen = await idsFor(ADMIN);
    assert.ok(seen.includes(IDS.expired));
    assert.ok(seen.includes(IDS.everyone));
  });

  it("no audience row is visible to an unrelated department", async () => {
    const seen = await idsFor(STUDENT_B);
    assert.deepEqual(seen, [IDS.everyone]);
  });
});

describe("repost visibility", () => {
  it("a repost never outlives the visibility of the post it carries", async () => {
    // A private post by the admin, reposted publicly by the admin.
    const privatePost = (
      await client.query(
        `INSERT INTO public.posts (author_id, content, type, visibility)
         VALUES ($1, 'secret', 'text', 'private') RETURNING id;`,
        [ADMIN]
      )
    ).rows[0].id;

    await client.query(
      `INSERT INTO public.reposts (reposter_id, original_post_id, visibility)
       VALUES ($1, $2, 'public');`,
      [ADMIN, privatePost]
    );

    const seen = await client.query(
      `SELECT id FROM public.visible_reposts($1::text) r
        WHERE r.original_post_id = $2::uuid;`,
      [STUDENT_A, privatePost]
    );

    assert.equal(seen.rows.length, 0);
  });
});
