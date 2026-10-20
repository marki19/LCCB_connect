const express = require("express");
const router = express.Router();
const catalogController = require("../controllers/catalogController");
const {
  validate,
  createDepartmentSchema,
  updateDepartmentSchema,
  createCourseSchema,
  updateCourseSchema,
} = require("../validation");

// Mounted at /api/admin behind requireAuth + loadProfile + requireRole(admin).
// Departments and courses are admin-managed runtime data (Messaging_plan.md §3).

// Departments
router.get("/departments", catalogController.listAllDepartments);
router.post("/departments", validate(createDepartmentSchema), catalogController.createDepartment);
router.put("/departments/:id", validate(updateDepartmentSchema), catalogController.updateDepartment);
router.post("/departments/:id/activate", catalogController.activateDepartment);
router.post("/departments/:id/deactivate", catalogController.deactivateDepartment);

// Courses
router.get("/courses", catalogController.listAllCourses);
router.post("/courses", validate(createCourseSchema), catalogController.createCourse);
router.put("/courses/:id", validate(updateCourseSchema), catalogController.updateCourse);
router.post("/courses/:id/activate", catalogController.activateCourse);
router.post("/courses/:id/deactivate", catalogController.deactivateCourse);

module.exports = router;
