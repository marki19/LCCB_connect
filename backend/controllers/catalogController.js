const departmentModel = require("../models/departmentModel");

/**
 * Catalog controller — departments & courses (Messaging_plan.md §3).
 *
 * The catalog is admin-managed RUNTIME DATA: nothing is hardcoded, and the
 * shipped app contains zero department/course names.
 *
 *   * Reads are guest-accessible (`/api/public/...`) because the registration
 *     form needs the list before the caller has a token.
 *   * Writes are admin-only — enforced by the mount in app.js.
 *   * There is no delete: entries are deactivated so existing profile/course
 *     references stay valid.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === "string" && UUID_RE.test(value);

/** An empty/whitespace code is "no code", not the empty string. */
const normalizeCode = (code) => {
  if (code === undefined || code === null) return null;
  const trimmed = String(code).trim();
  return trimmed === "" ? null : trimmed;
};

const sendBadId = (res) => res.status(400).json({ error: "Invalid id" });

/** Map integrity errors to client responses instead of a leaked 500. */
const handleCatalogError = (error, res, next) => {
  if (error && error.code === "23505") {
    return res.status(409).json({ error: "That name or code is already in use" });
  }
  if (error && error.code === "23503") {
    return res.status(400).json({ error: "Unknown department reference" });
  }
  return next(error);
};

// ---- public reads (used by the registration + settings pickers) ------------

const getDepartments = async (req, res, next) => {
  try {
    res.json(await departmentModel.listDepartments({ includeInactive: false }));
  } catch (error) {
    next(error);
  }
};

const getCourses = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return sendBadId(res);
    res.json(await departmentModel.listCourses({ departmentId: id, includeInactive: false }));
  } catch (error) {
    next(error);
  }
};

// ---- admin: departments ----------------------------------------------------

const listAllDepartments = async (req, res, next) => {
  try {
    res.json(await departmentModel.listDepartments({ includeInactive: true }));
  } catch (error) {
    next(error);
  }
};

const createDepartment = async (req, res, next) => {
  try {
    const created = await departmentModel.createDepartment({
      name: req.body.name,
      code: normalizeCode(req.body.code),
      sort_order: req.body.sort_order ?? 0,
      actorId: req.user.id,
    });
    res.status(201).json(created);
  } catch (error) {
    handleCatalogError(error, res, next);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return sendBadId(res);
    const updated = await departmentModel.updateDepartment(id, {
      name: req.body.name,
      code: normalizeCode(req.body.code),
      sort_order: req.body.sort_order,
      actorId: req.user.id,
    });
    if (!updated) return res.status(404).json({ error: "Department not found" });
    res.json(updated);
  } catch (error) {
    handleCatalogError(error, res, next);
  }
};

const setDepartmentActive = async (req, res, next, isActive) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return sendBadId(res);
    const updated = await departmentModel.setDepartmentActive(id, isActive, req.user.id);
    if (!updated) return res.status(404).json({ error: "Department not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const activateDepartment = (req, res, next) => setDepartmentActive(req, res, next, true);
const deactivateDepartment = (req, res, next) => setDepartmentActive(req, res, next, false);

// ---- admin: courses --------------------------------------------------------

const listAllCourses = async (req, res, next) => {
  try {
    const departmentId = req.query.department_id || null;
    if (departmentId && !isUuid(departmentId)) return sendBadId(res);
    res.json(await departmentModel.listCourses({ departmentId, includeInactive: true }));
  } catch (error) {
    next(error);
  }
};

const createCourse = async (req, res, next) => {
  try {
    const created = await departmentModel.createCourse({
      departmentId: req.body.department_id,
      name: req.body.name,
      code: normalizeCode(req.body.code),
      sort_order: req.body.sort_order ?? 0,
      actorId: req.user.id,
    });
    res.status(201).json(created);
  } catch (error) {
    handleCatalogError(error, res, next);
  }
};

const updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return sendBadId(res);
    const updated = await departmentModel.updateCourse(id, {
      departmentId: req.body.department_id,
      name: req.body.name,
      code: normalizeCode(req.body.code),
      sort_order: req.body.sort_order,
      actorId: req.user.id,
    });
    if (!updated) return res.status(404).json({ error: "Course not found" });
    res.json(updated);
  } catch (error) {
    handleCatalogError(error, res, next);
  }
};

const setCourseActive = async (req, res, next, isActive) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return sendBadId(res);
    const updated = await departmentModel.setCourseActive(id, isActive, req.user.id);
    if (!updated) return res.status(404).json({ error: "Course not found" });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

const activateCourse = (req, res, next) => setCourseActive(req, res, next, true);
const deactivateCourse = (req, res, next) => setCourseActive(req, res, next, false);

module.exports = {
  getDepartments,
  getCourses,
  listAllDepartments,
  createDepartment,
  updateDepartment,
  activateDepartment,
  deactivateDepartment,
  listAllCourses,
  createCourse,
  updateCourse,
  activateCourse,
  deactivateCourse,
};
