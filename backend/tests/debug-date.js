const db = require("../db");
const verificationModel = require("../models/verificationModel");
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
  const email = "debug-" + Math.random().toString(36).slice(2) + "@lccbonline.edu.ph";
  const deptCode = "TD" + Math.random().toString(36).slice(2, 8);
  const dept = await db.query(
    "INSERT INTO public.departments (name, code) VALUES ($1, $2) RETURNING id",
    ["Test Dept " + deptCode, deptCode]
  );
  const course = await db.query(
    "INSERT INTO public.courses (name, department_id) VALUES ($1, $2) RETURNING id",
    ["Test Course " + deptCode, dept.rows[0].id]
  );
  await db.query(
    "INSERT INTO public.profiles (id, email, full_name, role, verification_status) VALUES ($1, $2, 'Test Student', 'student', 'unverified')",
    [studentId, email]
  );

  const studentIdValue = "2023-" + Math.random().toString(36).slice(2, 7);

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

  try {
    await verificationController.submit(req, res, next);
    console.log("Status:", res.statusCode);
    console.log("Body birthdate:", res.body.birthdate, typeof res.body.birthdate);
    console.log("String:", String(res.body.birthdate));
    console.log("StartsWith 2000-01-15:", String(res.body.birthdate).startsWith("2000-01-15"));
  } catch (e) {
    console.error("Error:", e.message);
  }

  // Test getLatestForUser
  const result = await verificationModel.getLatestForUser(studentId);
  console.log("\ngetLatestForUser birthdate:", result.birthdate, typeof result.birthdate);
  console.log("String:", String(result.birthdate));
  console.log("StartsWith 2000-01-15:", String(result.birthdate).startsWith("2000-01-15"));

  await db.query("DELETE FROM public.profile_verification_requests WHERE user_id = $1", [studentId]);
  await db.query("DELETE FROM public.profiles WHERE id = $1", [studentId]);
  await db.query("DELETE FROM public.courses WHERE id = $1", [course.rows[0].id]);
  await db.query("DELETE FROM public.departments WHERE id = $1", [dept.rows[0].id]);
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });