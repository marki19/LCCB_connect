const db = require("../db");
const verificationController = require("../controllers/verificationController");
const userModel = require("../models/userModel");
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
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

function makeNext() {
  return (err) => { console.error("next called with:", err); throw err; };
}

async function test() {
  const studentId = "debug-stu-" + Math.random().toString(36).slice(2);
  const adminId = "debug-adm-" + Math.random().toString(36).slice(2);
  const email = "debug-" + Math.random().toString(36).slice(2) + "@lccbonline.edu.ph";
  const adminEmail = "admin-" + Math.random().toString(36).slice(2) + "@lccbonline.edu.ph";
  const deptCode = "TD" + Math.random().toString(36).slice(2, 8);
  const dept = await db.query(
    "INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id",
    ["Test Dept " + deptCode, deptCode]
  );
  const course = await db.query(
    "INSERT INTO public.courses (name, department_id) VALUES ($1, $2) RETURNING id",
    ["Test Course " + deptCode, dept.rows[0].id]
  );
  const studentIdValue = "2023-" + Math.random().toString(36).slice(2, 7);
  await db.query(
    "INSERT INTO public.profiles (id, email, full_name, student_id, department_id, course_id, role, verification_status) VALUES ($1, $2, 'To Decline', $3, $4, $5, 'student', 'pending')",
    [studentId, email, studentIdValue, dept.rows[0].id, course.rows[0].id]
  );
  await db.query(
    "INSERT INTO public.profiles (id, email, full_name, role, verification_status) VALUES ($1, $2, 'Admin User', 'admin', 'verified')",
    [adminId, adminEmail]
  );

  const request = await db.query(
    "INSERT INTO public.profile_verification_requests (user_id, full_name, student_id, department_id, course_id, year_level, status) VALUES ($1, 'To Decline', $2, $3, $4, '2nd Year', 'pending') RETURNING *",
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

  try {
    await verificationController.decline(req, res, next);
    console.log("Status:", res.statusCode);
    console.log("Body:", res.body);
  } catch (e) {
    console.error("Error:", e.message);
    console.error(e.stack);
  }

  await db.query("DELETE FROM public.profile_verification_requests WHERE user_id = $1", [studentId]);
  await db.query("DELETE FROM public.profiles WHERE id = $1", [studentId]);
  await db.query("DELETE FROM public.profiles WHERE id = $1", [adminId]);
  await db.query("DELETE FROM public.courses WHERE id = $1", [course.rows[0].id]);
  await db.query("DELETE FROM public.departments WHERE id = $1", [dept.rows[0].id]);
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });