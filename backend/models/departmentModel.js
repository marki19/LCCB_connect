const db = require("../db");

// RAW SQL ONLY (NO ORM METHODS).
//
// The catalog (departments + courses) is admin-managed RUNTIME DATA — see
// Messaging_plan.md §3. Nothing here is hardcoded, and rows are never
// hard-deleted: `is_active` is flipped so existing profile/course references
// stay valid.

const DEPARTMENT_COLUMNS = "id, code, name, sort_order, is_active, created_at, updated_at";
const COURSE_COLUMNS =
  "id, department_id, code, name, sort_order, is_active, created_at, updated_at";

const listDepartments = async ({ includeInactive = false } = {}) => {
  const sql = `
    SELECT ${DEPARTMENT_COLUMNS}
    FROM public.departments
    ${includeInactive ? "" : "WHERE is_active = TRUE"}
    ORDER BY sort_order ASC, name ASC;
  `;
  const result = await db.query(sql);
  return result.rows;
};

const getDepartmentById = async (id) => {
  const result = await db.query(
    `SELECT ${DEPARTMENT_COLUMNS} FROM public.departments WHERE id = $1;`,
    [id]
  );
  return result.rows[0];
};

/** Used by the "claim once" profile check — a deactivated department is not assignable. */
const getActiveDepartmentById = async (id) => {
  const result = await db.query(
    `SELECT ${DEPARTMENT_COLUMNS} FROM public.departments WHERE id = $1 AND is_active = TRUE;`,
    [id]
  );
  return result.rows[0];
};

const createDepartment = async ({ name, code = null, sort_order = 0, actorId = null }) => {
  const result = await db.query(
    `INSERT INTO public.departments (name, code, sort_order, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $4)
     RETURNING ${DEPARTMENT_COLUMNS};`,
    [name, code, sort_order, actorId]
  );
  return result.rows[0];
};

const updateDepartment = async (id, { name, code, sort_order, actorId = null }) => {
  const result = await db.query(
    `UPDATE public.departments
        SET name = COALESCE($2, name),
            code = COALESCE($3, code),
            sort_order = COALESCE($4, sort_order),
            updated_by = $5
      WHERE id = $1
      RETURNING ${DEPARTMENT_COLUMNS};`,
    [id, name ?? null, code ?? null, sort_order ?? null, actorId]
  );
  return result.rows[0];
};

const setDepartmentActive = async (id, isActive, actorId = null) => {
  const result = await db.query(
    `UPDATE public.departments
        SET is_active = $2, updated_by = $3
      WHERE id = $1
      RETURNING ${DEPARTMENT_COLUMNS};`,
    [id, isActive, actorId]
  );
  return result.rows[0];
};

const listCourses = async ({ departmentId = null, includeInactive = false } = {}) => {
  const params = [];
  const where = [];
  if (departmentId) {
    params.push(departmentId);
    where.push(`department_id = $${params.length}`);
  }
  if (!includeInactive) where.push("is_active = TRUE");

  const sql = `
    SELECT ${COURSE_COLUMNS}
    FROM public.courses
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY sort_order ASC, name ASC;
  `;
  const result = await db.query(sql, params);
  return result.rows;
};

const getCourseById = async (id) => {
  const result = await db.query(
    `SELECT ${COURSE_COLUMNS} FROM public.courses WHERE id = $1;`,
    [id]
  );
  return result.rows[0];
};

const getActiveCourseById = async (id) => {
  const result = await db.query(
    `SELECT ${COURSE_COLUMNS} FROM public.courses WHERE id = $1 AND is_active = TRUE;`,
    [id]
  );
  return result.rows[0];
};

const createCourse = async ({
  departmentId,
  name,
  code = null,
  sort_order = 0,
  actorId = null,
}) => {
  const result = await db.query(
    `INSERT INTO public.courses (department_id, name, code, sort_order, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5)
     RETURNING ${COURSE_COLUMNS};`,
    [departmentId, name, code, sort_order, actorId]
  );
  return result.rows[0];
};

const updateCourse = async (id, { departmentId, name, code, sort_order, actorId = null }) => {
  const result = await db.query(
    `UPDATE public.courses
        SET department_id = COALESCE($2, department_id),
            name = COALESCE($3, name),
            code = COALESCE($4, code),
            sort_order = COALESCE($5, sort_order),
            updated_by = $6
      WHERE id = $1
      RETURNING ${COURSE_COLUMNS};`,
    [id, departmentId ?? null, name ?? null, code ?? null, sort_order ?? null, actorId]
  );
  return result.rows[0];
};

const setCourseActive = async (id, isActive, actorId = null) => {
  const result = await db.query(
    `UPDATE public.courses
        SET is_active = $2, updated_by = $3
      WHERE id = $1
      RETURNING ${COURSE_COLUMNS};`,
    [id, isActive, actorId]
  );
  return result.rows[0];
};

module.exports = {
  listDepartments,
  getDepartmentById,
  getActiveDepartmentById,
  createDepartment,
  updateDepartment,
  setDepartmentActive,
  listCourses,
  getCourseById,
  getActiveCourseById,
  createCourse,
  updateCourse,
  setCourseActive,
};
