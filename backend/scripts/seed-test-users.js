// Seeds one test account per role for the testing phase.
//
//   node scripts/seed-test-users.js            # create/refresh accounts
//   node scripts/seed-test-users.js --cleanup  # delete them
//
// Idempotent: re-running finds each auth user by email, resets the password
// from TEST_USER_PASSWORD, and refreshes the profile instead of duplicating
// rows.
//
// Roles use the canonical spellings; the DB also accepts variants
// (department_admin, superAdmin) for backward compatibility.
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const db = require("../db");
const { createClient } = require("@supabase/supabase-js");

const PASSWORD = process.env.TEST_USER_PASSWORD;
const YEAR_LEVEL = "3rd Year";

const DEPARTMENT = {
  code: "CCS",
  name: "College of Computer Studies",
};

const COURSE = {
  code: "BSIT",
  name: "BS Information Technology",
};

// `department` / `course` flags decide which catalog links the profile gets:
//   student        -> department + course
//   faculty        -> department only
//   departmentAdmin-> department only (required for moderation scope)
//   admin/superadmin -> neither
const TEST_USERS = [
  {
    role: "student",
    email: "student@lccb.edu.ph",
    username: "student_test",
    full_name: "Student Test",
    department: true,
    course: true,
  },
  {
    role: "faculty",
    email: "faculty@lccb.edu.ph",
    username: "faculty_test",
    full_name: "Faculty Test",
    department: true,
    course: false,
  },
  {
    role: "departmentAdmin",
    email: "deptadmin@lccb.edu.ph",
    username: "deptadmin_test",
    full_name: "Department Admin Test",
    department: true,
    course: false,
  },
  {
    role: "admin",
    email: "admin@lccb.edu.ph",
    username: "admin_test",
    full_name: "Admin Test",
    department: false,
    course: false,
  },
  {
    role: "superadmin",
    email: "superadmin@lccb.edu.ph",
    username: "superadmin_test",
    full_name: "Super Admin Test",
    department: false,
    course: false,
  },
];

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function seedCatalog() {
  const dept = await db.query(
    `INSERT INTO public.departments (code, name, sort_order, is_active)
     VALUES ($1, $2, 0, true)
     ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name, is_active = true
     RETURNING id;`,
    [DEPARTMENT.code, DEPARTMENT.name]
  );
  const departmentId = dept.rows[0].id;

  const course = await db.query(
    `INSERT INTO public.courses (department_id, code, name, sort_order, is_active)
     VALUES ($1, $2, $3, 0, true)
     ON CONFLICT (department_id, name) DO UPDATE
       SET code = EXCLUDED.code, is_active = true
     RETURNING id;`,
    [departmentId, COURSE.code, COURSE.name]
  );

  return { departmentId, courseId: course.rows[0].id };
}

async function findAuthUserId(email) {
  const res = await db.query(
    `SELECT id::text AS id FROM auth.users WHERE lower(email) = lower($1);`,
    [email]
  );
  return res.rows[0]?.id ?? null;
}

async function upsertAuthUser(user) {
  const existingId = await findAuthUserId(user.email);

  if (existingId) {
    const { error } = await supabase.auth.admin.updateUserById(existingId, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { username: user.username, full_name: user.full_name },
    });
    if (error) throw new Error(`updateUserById ${user.email}: ${error.message}`);
    return existingId;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username: user.username, full_name: user.full_name },
  });
  if (error) throw new Error(`createUser ${user.email}: ${error.message}`);
  return data.user.id;
}

async function upsertProfile(id, user, catalog) {
  const departmentId = user.department ? catalog.departmentId : null;
  const courseId = user.course ? catalog.courseId : null;
  const courseName = user.course ? COURSE.name : null;

  await db.query(
    `INSERT INTO public.profiles
       (id, username, full_name, role, department_id, course_id, course, year_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       username = EXCLUDED.username,
       full_name = EXCLUDED.full_name,
       role = EXCLUDED.role,
       department_id = EXCLUDED.department_id,
       course_id = EXCLUDED.course_id,
       course = EXCLUDED.course,
       year_level = EXCLUDED.year_level;`,
    [
      id,
      user.username,
      user.full_name,
      user.role,
      departmentId,
      courseId,
      courseName,
      user.role === "student" ? YEAR_LEVEL : null,
    ]
  );
}

async function run() {
  if (!PASSWORD) {
    throw new Error("TEST_USER_PASSWORD must be set in backend/.env");
  }

  const catalog = await seedCatalog();
  console.log(
    `catalog: ${DEPARTMENT.name} (${DEPARTMENT.code}) + ${COURSE.name} (${COURSE.code})`
  );

  for (const user of TEST_USERS) {
    const id = await upsertAuthUser(user);
    await upsertProfile(id, user, catalog);
    console.log(`${user.role.padEnd(16)} ${user.email.padEnd(24)} id=${id}`);
  }

  console.log(`\nseeded ${TEST_USERS.length} accounts`);
}

async function cleanup() {
  for (const user of TEST_USERS) {
    const id = await findAuthUserId(user.email);
    if (id) {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) throw new Error(`deleteUser ${user.email}: ${error.message}`);
    }
    await db.query(`DELETE FROM public.profiles WHERE id = $1;`, [id ?? ""]);
    console.log(`deleted ${user.email}`);
  }
  console.log("\ntest accounts removed");
}

async function main() {
  if (process.argv.includes("--cleanup")) {
    await cleanup();
  } else {
    await run();
  }
  await db.pool.end();
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
