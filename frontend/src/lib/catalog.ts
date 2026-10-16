import { apiJson } from "./api";
import type { Department, Course } from "../types";

/**
 * Catalog helpers (Messaging_plan.md §3).
 *
 * Departments and courses are admin-managed RUNTIME DATA — fetched live, never
 * hardcoded. These hit the /public/* routes so they also work before login (the
 * registration form runs pre-auth), and they return active entries only.
 */

export async function fetchDepartments(): Promise<Department[]> {
  const data = await apiJson<Department[]>("/public/departments");
  return Array.isArray(data) ? data : [];
}

export async function fetchCourses(departmentId: string): Promise<Course[]> {
  const data = await apiJson<Course[]>(`/public/departments/${departmentId}/courses`);
  return Array.isArray(data) ? data : [];
}
