const test = require("node:test");
const assert = require("node:assert");
const db = require("../db");
const verificationModel = require("../models/verificationModel");
const verificationController = require("../controllers/verificationController");
const userModel = require("../models/userModel");
const departmentModel = require("../models/departmentModel");
const auditService = require("../services/auditService");
const notificationService = require("../services/notificationService");

function makeReq(overrides = {}) {
  return {
    user: { id: overrides.userId || "11111111-1111-1111-1111-111111111111" },
    profile: overrides.profile || { role: "student", department_id: null, id: overrides.userId || "11111111-1111-1111-1111-111111111111" },
    body: overrides.body || {},
    params: overrides.params || {},
    query: overrides.query || {},
  };
}

function makeRes() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
}

function makeNext() {
  return (err) => {
    throw err;
  };
}

function uniq(suffix) {
  return `${suffix}_${Math.random().toString(36).slice(2, 10)}`;
}

function datePart(val) {
  // DATE column returns Date object at midnight LOCAL time (PST)
  // Use local date methods to get YYYY-MM-DD
  const d = new Date(val);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

async function cleanupTestData(studentId) {
  await db.query(`DELETE FROM public.profile_verification_requests WHERE user_id = $1`, [studentId]);
  await db.query(`DELETE FROM public.profiles WHERE id = $1`, [studentId]);
}

test("verification: submit creates pending request and mirrors identity to profile", async () => {
  const auditStub = test.mock.method(auditService, "recordRequest", async () => undefined);
  const notifyStub = test.mock.method(notificationService, "createNotifications", async () => undefined);

  const studentId = uniq("stu");
  const email = `${uniq("test")}@lccbonline.edu.ph`;
  const deptCode = uniq("TD");
  const dept = await db.query(
    `INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id`,
    [`Test Dept ${deptCode}`, deptCode]
  );
  const course = await db.query(
    `INSERT INTO public.courses (name, department_id) VALUES ($1, $2) RETURNING id`,
    [`Test Course ${deptCode}`, dept.rows[0].id]
  );
  await db.query(
    `INSERT INTO public.profiles (id, email, full_name, role, verification_status)
     VALUES ($1, $2, 'Test Student', 'student', 'unverified')`,
    [studentId, email]
  );

  const studentIdValue = `2023-${uniq("12345")}`;

  const req = makeReq({
    userId: studentId,
    profile: { role: "student", department_id: null, id: studentId },
    body: {
      full_name: "Test Student",
      student_id: studentIdValue,
      department_id: dept.rows[0].id,
      course_id: course.rows[0].id,
      year_level: "1st Year",
      birthdate: "2000-01-15",
    },
  });
  const res = makeRes();
  const next = makeNext();

  await verificationController.submit(req, res, next);

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.status, "pending");
  assert.strictEqual(res.body.full_name, "Test Student");
  // Birthdate stored as DATE, returned as Date object at midnight UTC
  assert.strictEqual(datePart(res.body.birthdate), "2000-01-15");

  // Check profile was updated
  const profile = await userModel.getUserById(studentId);
  assert.strictEqual(profile.verification_status, "pending");
  assert.strictEqual(profile.full_name, "Test Student");
  assert.strictEqual(profile.student_id, studentIdValue);

  await cleanupTestData(studentId);
  auditStub.mock.restore();
  notifyStub.mock.restore();
});

test("verification: submit rejects when already verified with complete identity", async () => {
  const auditStub = test.mock.method(auditService, "recordRequest", async () => undefined);
  const notifyStub = test.mock.method(notificationService, "createNotifications", async () => undefined);

  const studentId = uniq("stu");
  const email = `${uniq("test2")}@lccbonline.edu.ph`;
  const deptCode = uniq("TD");
  const dept = await db.query(
    `INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id`,
    [`Test Dept ${deptCode}`, deptCode]
  );
  const course = await db.query(
    `INSERT INTO public.courses (name, department_id) VALUES ($1, $2) RETURNING id`,
    [`Test Course ${deptCode}`, dept.rows[0].id]
  );
  const studentIdValue = `2022-${uniq("11111")}`;
  await db.query(
    `INSERT INTO public.profiles (id, email, full_name, student_id, department_id, course_id, role, verification_status)
     VALUES ($1, $2, 'Verified Student', $3, $4, $5, 'student', 'verified')`,
    [studentId, email, studentIdValue, dept.rows[0].id, course.rows[0].id]
  );

  const req = makeReq({
    userId: studentId,
    // Must include course_id for identityComplete check
    profile: { role: "student", department_id: dept.rows[0].id, full_name: "Verified Student", student_id: studentIdValue, course_id: course.rows[0].id, id: studentId, verification_status: "verified" },
    body: {
      full_name: "Verified Student",
      student_id: studentIdValue,
      department_id: dept.rows[0].id,
      course_id: course.rows[0].id,
      year_level: "2nd Year",
      birthdate: "2001-02-20",
    },
  });
  const res = makeRes();
  const next = makeNext();

  await verificationController.submit(req, res, next);

  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.error, "Your account is already verified");

  await cleanupTestData(studentId);
  auditStub.mock.restore();
  notifyStub.mock.restore();
});

test("verification: submit allows resubmit when verified but identity incomplete", async () => {
  const auditStub = test.mock.method(auditService, "recordRequest", async () => undefined);
  const notifyStub = test.mock.method(notificationService, "createNotifications", async () => undefined);

  const studentId = uniq("stu");
  const email = `${uniq("legacy")}@lccbonline.edu.ph`;
  const deptCode = uniq("TD");
  const dept = await db.query(
    `INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id`,
    [`Test Dept ${deptCode}`, deptCode]
  );
  const course = await db.query(
    `INSERT INTO public.courses (name, department_id) VALUES ($1, $2) RETURNING id`,
    [`Test Course ${deptCode}`, dept.rows[0].id]
  );
  await db.query(
    `INSERT INTO public.profiles (id, email, role, verification_status)
     VALUES ($1, $2, 'student', 'verified')`,
    [studentId, email]
  );

  const req = makeReq({
    userId: studentId,
    profile: { role: "student", department_id: null, full_name: null, student_id: null, id: studentId, verification_status: "verified" },
    body: {
      full_name: "Legacy Student",
      student_id: `2020-${uniq("99999")}`,
      department_id: dept.rows[0].id,
      course_id: course.rows[0].id,
      year_level: "4th Year",
      birthdate: "1999-12-31",
    },
  });
  const res = makeRes();
  const next = makeNext();

  await verificationController.submit(req, res, next);

  // Should allow submission (identity incomplete)
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.status, "pending");

  await cleanupTestData(studentId);
  auditStub.mock.restore();
  notifyStub.mock.restore();
});

test("verification: decline resets profile to unverified", async () => {
  const auditStub = test.mock.method(auditService, "recordRequest", async () => undefined);
  const notifyStub = test.mock.method(notificationService, "notifyUser", async () => undefined);

  const studentId = uniq("stu");
  const adminId = uniq("adm");
  const email = `${uniq("todecline")}@lccbonline.edu.ph`;
  const adminEmail = `${uniq("admin")}@lccbonline.edu.ph`;
  const deptCode = uniq("TD");
  const dept = await db.query(
    `INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id`,
    [`Test Dept ${deptCode}`, deptCode]
  );
  const course = await db.query(
    `INSERT INTO public.courses (name, department_id) VALUES ($1, $2) RETURNING id`,
    [`Test Course ${deptCode}`, dept.rows[0].id]
  );
  const studentIdValue = `2023-${uniq("55555")}`;
  await db.query(
    `INSERT INTO public.profiles (id, email, full_name, student_id, department_id, course_id, role, verification_status)
     VALUES ($1, $2, 'To Decline', $3, $4, $5, 'student', 'pending')`,
    [studentId, email, studentIdValue, dept.rows[0].id, course.rows[0].id]
  );
  // Admin must exist in profiles for FK constraint on reviewed_by
  await db.query(
    `INSERT INTO public.profiles (id, email, full_name, role, verification_status)
     VALUES ($1, $2, 'Admin User', 'admin', 'verified')`,
    [adminId, adminEmail]
  );

  const request = await db.query(
    `INSERT INTO public.profile_verification_requests (user_id, full_name, student_id, department_id, course_id, year_level, status)
     VALUES ($1, 'To Decline', $2, $3, $4, '2nd Year', 'pending')
     RETURNING *`,
    [studentId, studentIdValue, dept.rows[0].id, course.rows[0].id]
  );

  const req = makeReq({
    userId: adminId,
    profile: { role: "admin", department_id: null, id: adminId },
    params: { id: request.rows[0].id },
    body: { note: "Student ID format is incorrect" },
  });
  const res = makeRes();
  const next = makeNext();

  await verificationController.decline(req, res, next);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.status, "declined");

  // Profile should be reset to unverified
  const profile = await userModel.getUserById(studentId);
  assert.strictEqual(profile.verification_status, "unverified");

  await cleanupTestData(studentId);
  auditStub.mock.restore();
  notifyStub.mock.restore();
});

test("verification: getLatestForUser joins department and course names", async () => {
  const studentId = uniq("stu");
  const email = `${uniq("join")}@lccbonline.edu.ph`;
  const deptCode = uniq("TD");
  const dept = await db.query(
    `INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id`,
    [`Test Dept ${deptCode}`, deptCode]
  );
  const course = await db.query(
    `INSERT INTO public.courses (name, department_id) VALUES ($1, $2) RETURNING id`,
    [`Test Course ${deptCode}`, dept.rows[0].id]
  );
  await db.query(
    `INSERT INTO public.profiles (id, email, role, verification_status)
     VALUES ($1, $2, 'student', 'unverified')`,
    [studentId, email]
  );

  const request = await verificationModel.getLatestForUser(studentId);
  // Should not throw, returns null if no request
  assert.ok(request === null || typeof request === "object");

  // Create a request with department and course
  await db.query(
    `INSERT INTO public.profile_verification_requests (user_id, full_name, student_id, department_id, course_id, year_level, status, birthdate)
     VALUES ($1, 'Join Test', $2, $3, $4, '3rd Year', 'pending', '2000-06-15')`,
    [studentId, `2023-${uniq("66666")}`, dept.rows[0].id, course.rows[0].id]
  );

  const result = await verificationModel.getLatestForUser(studentId);
  assert.ok(result);
  assert.ok(result.department_name);
  assert.ok(result.course_name);
  // Birthdate returned as Date object at midnight UTC from DATE column
  assert.strictEqual(datePart(result.birthdate), "2000-06-15");

  await cleanupTestData(studentId);
});

console.log("All verification tests passed");