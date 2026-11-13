// Verification policy (services/verificationPolicy.js).
//
// Pure functions, no database: the approval matrix and the per-role form shape
// are the two things every other layer reads, so they are pinned here rather
// than inferred from an integration test.
require("./env.helper");

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const policy = require("../services/verificationPolicy");
const controller = require("../controllers/verificationController");

describe("form shape per role", () => {
  it("a student proves a full academic identity", () => {
    assert.deepEqual(policy.fieldsFor("student"), {
      department: true,
      course: true,
      yearLevel: true,
    });
  });

  it("faculty and department admins prove employment, not a course", () => {
    for (const role of ["faculty", "departmentAdmin", "department_admin"]) {
      assert.deepEqual(
        policy.fieldsFor(role),
        { department: true, course: false, yearLevel: false },
        role
      );
    }
  });

  it("admins prove only name, ID and birthdate", () => {
    assert.deepEqual(policy.fieldsFor("admin"), {
      department: false,
      course: false,
      yearLevel: false,
    });
  });

  it("superadmins never verify", () => {
    assert.equal(policy.fieldsFor("superadmin"), null);
  });

  it("an unknown role verifies nothing", () => {
    assert.equal(policy.fieldsFor("intern"), null);
    assert.equal(policy.fieldsFor(undefined), null);
  });
});

describe("school accounts only", () => {
  it("accepts the school domain, case-insensitively", () => {
    assert.equal(policy.isSchoolAccount("ana@lccbonline.edu.ph"), true);
    assert.equal(policy.isSchoolAccount("Ana@LCCBOnline.EDU.PH"), true);
  });

  it("rejects everything else", () => {
    assert.equal(policy.isSchoolAccount("ana@gmail.com"), false);
    assert.equal(policy.isSchoolAccount("ana@lccbonline.edu.ph.evil.com"), false);
    assert.equal(policy.isSchoolAccount(""), false);
    assert.equal(policy.isSchoolAccount(null), false);
  });
});

describe("approval matrix", () => {
  const DEPT_A = "dept-a";
  const DEPT_B = "dept-b";

  const review = (reviewerRole, requestRole, { reviewerDept = DEPT_A, requestDept = DEPT_A } = {}) =>
    policy.canReview({
      reviewerRole,
      reviewerDepartmentId: reviewerDept,
      requestRole,
      requestDepartmentId: requestDept,
    });

  it("a superadmin decides admin and department-admin requests", () => {
    assert.equal(review("superadmin", "admin"), true);
    assert.equal(review("superadmin", "departmentAdmin", { requestDept: DEPT_B }), true);
  });

  it("a superadmin does not decide student or faculty requests", () => {
    for (const role of ["faculty", "student"]) {
      assert.equal(review("superadmin", role), false, role);
    }
  });

  it("an admin decides department-admin requests, in any department", () => {
    assert.equal(review("admin", "departmentAdmin"), true);
    assert.equal(review("admin", "departmentAdmin", { requestDept: DEPT_B }), true);
  });

  it("one admin never decides another admin's request", () => {
    assert.equal(review("admin", "admin"), false);
  });

  it("a department admin decides student and faculty requests inside their department", () => {
    assert.equal(review("departmentAdmin", "student"), true);
    assert.equal(review("departmentAdmin", "faculty"), true);
    assert.equal(
      review("departmentAdmin", "student", { requestDept: DEPT_B }),
      false
    );
  });

  it("a department admin never decides another department admin", () => {
    assert.equal(review("departmentAdmin", "departmentAdmin"), false);
  });

  it("a department admin with no department assigned decides nothing", () => {
    assert.equal(
      review("departmentAdmin", "student", { reviewerDept: null, requestDept: null }),
      false
    );
  });

  it("students and faculty review nothing", () => {
    assert.equal(review("student", "student"), false);
    assert.equal(review("faculty", "student"), false);
  });

  it("an unknown reviewer decides nothing", () => {
    assert.equal(review(undefined, "student"), false);
  });
});

describe("reviewer fan-out", () => {
  it("student and faculty requests go to their department admins only", () => {
    assert.deepEqual(policy.reviewersForRequest("student"), {
      campusRoles: [],
      departmentRoles: ["departmentAdmin"],
    });
    assert.deepEqual(policy.reviewersForRequest("faculty"), {
      campusRoles: [],
      departmentRoles: ["departmentAdmin"],
    });
  });

  it("department-admin requests go to superadmins and admins", () => {
    assert.deepEqual(policy.reviewersForRequest("departmentAdmin"), {
      campusRoles: ["superadmin", "admin"],
      departmentRoles: [],
    });
  });

  it("admin requests go to superadmins only", () => {
    assert.deepEqual(policy.reviewersForRequest("admin"), {
      campusRoles: ["superadmin"],
      departmentRoles: [],
    });
  });
});

describe("snapshot keeps only what the role proves", () => {
  const body = {
    full_name: "Ana Cruz",
    student_id: "ADM-00123",
    birthdate: "1990-04-02",
    department_id: "11111111-1111-4111-8111-111111111111",
    course_id: "22222222-2222-4222-8222-222222222222",
    year_level: "3rd Year",
  };

  it("drops course and year level for staff", () => {
    const { snapshot } = controller.snapshotFor("faculty", body);
    assert.equal(snapshot.role, "faculty");
    assert.equal(snapshot.department_id, body.department_id);
    assert.equal(snapshot.course_id, null);
    assert.equal(snapshot.year_level, null);
  });

  it("drops the whole catalog for an admin", () => {
    const { snapshot } = controller.snapshotFor("admin", body);
    assert.equal(snapshot.department_id, null);
    assert.equal(snapshot.course_id, null);
    assert.equal(snapshot.year_level, null);
  });

  it("requires a course from a student", () => {
    const { error } = controller.snapshotFor("student", { ...body, course_id: undefined });
    assert.equal(error, "Select your course");
  });

  it("requires a department from staff", () => {
    const { error } = controller.snapshotFor("faculty", { ...body, department_id: undefined });
    assert.equal(error, "Select your department");
  });

  it("refuses a role that does not verify", () => {
    const { error } = controller.snapshotFor("superadmin", body);
    assert.equal(error, "This account does not verify");
  });
});

describe("identity completeness follows the role", () => {
  it("a student is incomplete without a course", () => {
    assert.equal(
      controller.identityComplete({
        role: "student",
        full_name: "Ana",
        student_id: "2023-1",
        department_id: "d",
        course_id: null,
        year_level: "1st Year",
      }),
      false
    );
  });

  it("an admin is complete with only name and ID", () => {
    assert.equal(
      controller.identityComplete({
        role: "admin",
        full_name: "Ana",
        student_id: "ADM-00123",
      }),
      true
    );
  });
});
