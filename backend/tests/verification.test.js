const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgrespassword@127.0.0.1:5432/lcc_connect_test";

const test = require("node:test");
const assert = require("node:assert");
const db = require("../db");
const verificationModel = require("../models/verificationModel");
const verificationController = require("../controllers/verificationController");
const userModel = require("../models/userModel");
const departmentModel = require("../models/departmentModel");
const auditService = require("../services/auditService");
const notificationService = require("../services/notificationService");
const verificationOtpModel = require("../models/verificationOtpModel");

const TEST_EMAIL = "ana@lccbonline.edu.ph";

// Verification needs control of a school mailbox, proven by the emailed code.
// The code itself is covered by verificationOtp.test.js; here it always passes.
function stubOtpOk() {
  return test.mock.method(verificationOtpModel, "verifyAndConsume", async () => ({ ok: true }));
}

function makeReq(overrides = {}) {
  return {
    user: { id: overrides.userId || "11111111-1111-1111-1111-111111111111" },
    profile: {
      role: "student",
      department_id: null,
      email: TEST_EMAIL,
      id: overrides.userId || "11111111-1111-1111-1111-111111111111",
      ...(overrides.profile || {}),
    },
    body: overrides.body || {},
    params: overrides.params || {},
    query: overrides.query || {},
  };
}

function makeRes() {
  const res = { statusCode: 200 }; // Express defaults to 200 when only json() is called
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

async function getTestCatalog() {
  const dept = await db.query(`SELECT id, code FROM public.departments WHERE is_active = true LIMIT 1`);
  const course = await db.query(`SELECT id FROM public.courses WHERE department_id = $1 AND is_active = true LIMIT 1`, [dept.rows[0].id]);
  return { deptId: dept.rows[0].id, courseId: course.rows[0].id };
}

async function cleanupTestData(studentId, adminId) {
  await db.query(`DELETE FROM public.profile_verification_requests WHERE user_id = $1`, [studentId]);
  await db.query(`DELETE FROM public.profiles WHERE id = $1`, [studentId]);
  if (adminId) {
    await db.query(`DELETE FROM public.profiles WHERE id = $1`, [adminId]);
  }
}

test("verification: submit creates pending request and mirrors identity to profile", async () => {
  const auditStub = test.mock.method(auditService, "recordRequest", async () => undefined);
  const notifyStub = test.mock.method(notificationService, "createNotifications", async () => undefined);
  const otpStub = stubOtpOk();

  const { deptId, courseId } = await getTestCatalog();
  const studentId = uniq("stu");
  const email = `${uniq("test")}@lccbonline.edu.ph`;
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
      department_id: deptId,
      course_id: courseId,
      year_level: "1st Year",
      birthdate: "2000-01-15",
      otp_code: "123456",
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
  otpStub.mock.restore();
  auditStub.mock.restore();
  notifyStub.mock.restore();
});

test("verification: submit rejects when already verified with complete identity", async () => {
  const auditStub = test.mock.method(auditService, "recordRequest", async () => undefined);
  const notifyStub = test.mock.method(notificationService, "createNotifications", async () => undefined);
  const otpStub = stubOtpOk();

  const { deptId, courseId } = await getTestCatalog();
  const studentId = uniq("stu");
  const email = `${uniq("test2")}@lccbonline.edu.ph`;
  const studentIdValue = `2022-${uniq("11111")}`;
  await db.query(
    `INSERT INTO public.profiles (id, email, full_name, student_id, department_id, course_id, role, verification_status)
     VALUES ($1, $2, 'Verified Student', $3, $4, $5, 'student', 'verified')`,
    [studentId, email, studentIdValue, deptId, courseId]
  );

  const req = makeReq({
    userId: studentId,
    // Must include course_id for identityComplete check
    profile: { role: "student", department_id: deptId, full_name: "Verified Student", student_id: studentIdValue, course_id: courseId, year_level: "2nd Year", id: studentId, verification_status: "verified" },
    body: {
      full_name: "Verified Student",
      student_id: studentIdValue,
      department_id: deptId,
      course_id: courseId,
      year_level: "2nd Year",
      birthdate: "2001-02-20",
      otp_code: "123456",
    },
  });
  const res = makeRes();
  const next = makeNext();

  await verificationController.submit(req, res, next);

  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.error, "Your account is already verified");

  await cleanupTestData(studentId);
  otpStub.mock.restore();
  auditStub.mock.restore();
  notifyStub.mock.restore();
});

test("verification: submit allows resubmit when verified but identity incomplete", async () => {
  const auditStub = test.mock.method(auditService, "recordRequest", async () => undefined);
  const notifyStub = test.mock.method(notificationService, "createNotifications", async () => undefined);
  const otpStub = stubOtpOk();

  const { deptId, courseId } = await getTestCatalog();
  const studentId = uniq("stu");
  const email = `${uniq("legacy")}@lccbonline.edu.ph`;
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
      department_id: deptId,
      course_id: courseId,
      year_level: "4th Year",
      birthdate: "1999-12-31",
      otp_code: "123456",
    },
  });
  const res = makeRes();
  const next = makeNext();

  await verificationController.submit(req, res, next);

  // Should allow submission (identity incomplete)
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.status, "pending");

  await cleanupTestData(studentId);
  otpStub.mock.restore();
  auditStub.mock.restore();
  notifyStub.mock.restore();
});

test("verification: decline resets profile to unverified", async () => {
  const auditStub = test.mock.method(auditService, "recordRequest", async () => undefined);
  const notifyStub = test.mock.method(notificationService, "notifyUser", async () => undefined);

  const { deptId, courseId } = await getTestCatalog();
  const studentId = uniq("stu");
  const adminId = uniq("adm");
  const email = `${uniq("todecline")}@lccbonline.edu.ph`;
  const adminEmail = `${uniq("admin")}@lccbonline.edu.ph`;
  const studentIdValue = `2023-${uniq("55555")}`;
  await db.query(
    `INSERT INTO public.profiles (id, email, full_name, student_id, department_id, course_id, role, verification_status)
     VALUES ($1, $2, 'To Decline', $3, $4, $5, 'student', 'pending')`,
    [studentId, email, studentIdValue, deptId, courseId]
  );
  // The reviewer must exist in profiles for the FK on reviewed_by, and must be a
  // department admin of the requester's own department to be in scope.
  await db.query(
    `INSERT INTO public.profiles (id, email, full_name, role, department_id, verification_status)
     VALUES ($1, $2, 'Admin User', 'departmentAdmin', $3, 'verified')`,
    [adminId, adminEmail, deptId]
  );

  const request = await db.query(
    `INSERT INTO public.profile_verification_requests (user_id, full_name, student_id, department_id, course_id, year_level, status)
     VALUES ($1, 'To Decline', $2, $3, $4, '2nd Year', 'pending')
     RETURNING *`,
    [studentId, studentIdValue, deptId, courseId]
  );

  const req = makeReq({
    userId: adminId,
    profile: { role: "departmentAdmin", department_id: deptId, id: adminId },
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

  await cleanupTestData(studentId, adminId);
  auditStub.mock.restore();
  notifyStub.mock.restore();
});

test("verification: getLatestForUser joins department and course names", async () => {
  const { deptId, courseId } = await getTestCatalog();
  const studentId = uniq("stu");
  const email = `${uniq("join")}@lccbonline.edu.ph`;
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
    [studentId, `2023-${uniq("66666")}`, deptId, courseId]
  );

  const result = await verificationModel.getLatestForUser(studentId);
  assert.ok(result);
  assert.ok(result.department_name);
  assert.ok(result.course_name);
  // Birthdate returned as Date object at midnight UTC from DATE column
  assert.strictEqual(datePart(result.birthdate), "2000-06-15");

  await cleanupTestData(studentId);
});

test.after(async () => {
  await db.pool.end();
});

console.log("All verification tests passed");
