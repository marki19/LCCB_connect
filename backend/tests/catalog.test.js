// Departments & courses (admin-managed catalog) + the profile "claim-once"
// department rule. Auth and the models are stubbed, so the HTTP contract is
// asserted without a database.
require("./env.helper");

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { stub } = require("./stub.helper");
const auth = require("../middleware/auth");
const departmentModel = require("../models/departmentModel");
const userModel = require("../models/userModel");

const DEPT = "11111111-1111-4111-8111-111111111111";
const COURSE = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

// The "session" the stubbed requireAuth/loadProfile resolve to.
const session = { id: "u1", role: "student", department_id: null };

stub(auth, "requireAuth", (req, res, next) => {
  if (!(req.headers.authorization || "").startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: session.id };
  return next();
});
stub(auth, "loadProfile", (req, res, next) => {
  req.profile = { id: session.id, role: session.role, department_id: session.department_id };
  return next();
});

const m = {
  listDepartments: stub(departmentModel, "listDepartments"),
  getActiveDepartmentById: stub(departmentModel, "getActiveDepartmentById"),
  getActiveCourseById: stub(departmentModel, "getActiveCourseById"),
  createDepartment: stub(departmentModel, "createDepartment"),
  updateDepartment: stub(departmentModel, "updateDepartment"),
  setDepartmentActive: stub(departmentModel, "setDepartmentActive"),
  listCourses: stub(departmentModel, "listCourses"),
  createCourse: stub(departmentModel, "createCourse"),
  updateCourse: stub(departmentModel, "updateCourse"),
  setCourseActive: stub(departmentModel, "setCourseActive"),
  updateUser: stub(userModel, "updateUser"),
};

const app = require("../app");
const AUTH = { Authorization: "Bearer test-token" };

beforeEach(() => {
  for (const fn of Object.values(m)) {
    fn.calls.length = 0;
    fn.setImpl(() => undefined);
  }
  session.id = "u1";
  session.role = "student";
  session.department_id = null;
});

describe("public catalog reads (guest-reachable, for registration)", () => {
  it("lists active departments without a token", async () => {
    m.listDepartments.setImpl(async () => [{ id: DEPT, name: "CCS", is_active: true }]);

    const res = await request(app).get("/api/public/departments");

    assert.equal(res.status, 200);
    assert.deepEqual(m.listDepartments.calls.at(-1), [{ includeInactive: false }]);
  });

  it("lists courses for a department (active only)", async () => {
    m.listCourses.setImpl(async () => []);

    const res = await request(app).get(`/api/public/departments/${DEPT}/courses`);

    assert.equal(res.status, 200);
    assert.deepEqual(m.listCourses.calls.at(-1), [
      { departmentId: DEPT, includeInactive: false },
    ]);
  });

  it("rejects a malformed department id with 400 (no DB hit)", async () => {
    const res = await request(app).get("/api/public/departments/not-a-uuid/courses");

    assert.equal(res.status, 400);
    assert.equal(m.listCourses.calls.length, 0);
  });
});

describe("catalog writes are admin-only", () => {
  it("401 without a token", async () => {
    const res = await request(app).post("/api/admin/departments").send({ name: "CCS" });
    assert.equal(res.status, 401);
  });

  it("403 for a student", async () => {
    const res = await request(app)
      .post("/api/admin/departments")
      .set(AUTH)
      .send({ name: "CCS" });

    assert.equal(res.status, 403);
    assert.equal(m.createDepartment.calls.length, 0);
  });

  it("lets an admin create a department and records the actor", async () => {
    session.id = "admin1";
    session.role = "admin";
    m.createDepartment.setImpl(async (data) => ({ id: DEPT, ...data }));

    const res = await request(app)
      .post("/api/admin/departments")
      .set(AUTH)
      .send({ name: "College of Computer Studies", code: "CCS", sort_order: 1 });

    assert.equal(res.status, 201);
    const [args] = m.createDepartment.calls[0];
    assert.equal(args.name, "College of Computer Studies");
    assert.equal(args.code, "CCS");
    assert.equal(args.actorId, "admin1");
  });

  it("maps a unique violation to 409 instead of a 500", async () => {
    session.role = "admin";
    m.createDepartment.setImpl(async () => {
      const err = new Error("duplicate key");
      err.code = "23505";
      throw err;
    });

    const res = await request(app)
      .post("/api/admin/departments")
      .set(AUTH)
      .send({ name: "CCS" });

    assert.equal(res.status, 409);
  });

  it("rejects an empty name and unknown keys with 400", async () => {
    session.role = "admin";

    const empty = await request(app).post("/api/admin/departments").set(AUTH).send({ name: "" });
    assert.equal(empty.status, 400);

    const unknown = await request(app)
      .post("/api/admin/departments")
      .set(AUTH)
      .send({ name: "CCS", evil: true });
    assert.equal(unknown.status, 400);
    assert.equal(m.createDepartment.calls.length, 0);
  });

  it("deactivates (never deletes) a department", async () => {
    session.id = "admin1";
    session.role = "admin";
    m.setDepartmentActive.setImpl(async () => ({ id: DEPT, is_active: false }));

    const res = await request(app).post(`/api/admin/departments/${DEPT}/deactivate`).set(AUTH);

    assert.equal(res.status, 200);
    assert.deepEqual(m.setDepartmentActive.calls[0], [DEPT, false, "admin1"]);
  });

  it("creates a course scoped to a department", async () => {
    session.id = "admin1";
    session.role = "admin";
    m.createCourse.setImpl(async (data) => ({ id: COURSE, ...data }));

    const res = await request(app)
      .post("/api/admin/courses")
      .set(AUTH)
      .send({ department_id: DEPT, name: "BS Information Technology", code: "BSIT" });

    assert.equal(res.status, 201);
    assert.equal(m.createCourse.calls[0][0].departmentId, DEPT);
    assert.equal(m.createCourse.calls[0][0].actorId, "admin1");
  });

  it("requires department_id when creating a course", async () => {
    session.role = "admin";
    const res = await request(app)
      .post("/api/admin/courses")
      .set(AUTH)
      .send({ name: "BSIT" });

    assert.equal(res.status, 400);
    assert.equal(m.createCourse.calls.length, 0);
  });
});

describe("department is claim-once for non-admins", () => {
  it("lets a user set their department while it is unset", async () => {
    m.getActiveDepartmentById.setImpl(async () => ({ id: DEPT, is_active: true }));
    m.getActiveCourseById.setImpl(async () => ({ id: COURSE, department_id: DEPT, is_active: true }));
    m.updateUser.setImpl(async () => ({ id: "u1" }));

    const res = await request(app)
      .put("/api/users/u1")
      .set(AUTH)
      .send({ department_id: DEPT, course_id: COURSE });

    assert.equal(res.status, 200);
    const payload = m.updateUser.calls[0][1];
    assert.equal(payload.department_id, DEPT);
    assert.equal(payload.course_id, COURSE);
  });

  it("rejects a course that does not belong to the chosen department", async () => {
    m.getActiveDepartmentById.setImpl(async () => ({ id: DEPT, is_active: true }));
    m.getActiveCourseById.setImpl(async () => ({ id: COURSE, department_id: OTHER, is_active: true }));

    const res = await request(app)
      .put("/api/users/u1")
      .set(AUTH)
      .send({ department_id: DEPT, course_id: COURSE });

    assert.equal(res.status, 400);
    assert.equal(m.updateUser.calls.length, 0);
  });

  it("refuses to change a department that is already set", async () => {
    session.department_id = DEPT; // already assigned
    m.updateUser.setImpl(async () => ({ id: "u1" }));

    const res = await request(app)
      .put("/api/users/u1")
      .set(AUTH)
      .send({ department_id: OTHER, full_name: "Renamed" });

    assert.equal(res.status, 200);
    const payload = m.updateUser.calls[0][1];
    assert.equal(payload.full_name, "Renamed");
    assert.equal(payload.department_id, undefined, "a set department must not be changeable");
  });

  it("lets an admin change a department", async () => {
    session.id = "admin1";
    session.role = "admin";
    session.department_id = DEPT;
    m.getActiveDepartmentById.setImpl(async () => ({ id: OTHER, is_active: true }));
    m.updateUser.setImpl(async () => ({ id: "admin1" }));

    const res = await request(app)
      .put("/api/users/admin1")
      .set(AUTH)
      .send({ department_id: OTHER });

    assert.equal(res.status, 200);
    assert.equal(m.updateUser.calls[0][1].department_id, OTHER);
  });
});
