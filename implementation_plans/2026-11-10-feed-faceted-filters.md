# Feed Faceted Filters Implementation Plan

## 1. Problem & Architecture Overview

Currently, the campus feed in LCCB Connect only supports in-memory filtering by general post type (`websites`, `theses`, `projects`, `discussions`, `images`).
Students and faculty need the ability to focus their feed on:
1. **Department Scope**: See posts, announcements, and research specifically from their department (e.g., School of Information Technology, School of Business & Accountancy).
2. **Course Scope**: Narrow down further to specific degree programs (e.g., BSIT, BSCS, BSBA).

### Architecture
1. **Backend Database & Model (`backend/models/postModel.js`, `backend/models/thesisModel.js`)**:
   - `visiblePostsFor({ departmentId, courseId })`: Filters posts by author profile department/course and snapshotted department/course.
   - `getAllTheses({ departmentId })`: Filters theses by `t.department_id`.
2. **Backend API (`backend/controllers/postController.js`, `backend/controllers/thesisController.js`)**:
   - `GET /api/posts?department_id=<uuid>&course_id=<uuid>` parsed safely with `parseUuidFilter`.
   - `GET /api/theses?department_id=<uuid>` parsed safely with `parseUuidFilter`.
3. **Frontend Feed Screen (`frontend/app/(tabs)/index.tsx`)**:
   - Fetches live departments via `fetchDepartments()` from `catalog.ts`.
   - When a department is selected, fetches its courses via `fetchCourses(deptId)`.
   - Renders a compact, responsive faceted filter pill bar:
     - Department pills (All Departments, SIT, SBA, etc.) with Lucide SVG `<Building2 />`.
     - Cascaded Course pills (All Courses, BSIT, BSCS, etc.) with Lucide SVG `<GraduationCap />`.
     - Active filter badge + "Clear" button when filters are engaged.
   - Server-side parameter passing for scalable feed querying.

---

## 2. Phased Implementation Tasks

### Phase 1: Backend Filter Endpoints & Tests
- Update `backend/models/postModel.js` `visiblePostsFor` with `departmentId` & `courseId`.
- Update `backend/controllers/postController.js` `getPosts` to parse and pass `department_id` and `course_id`.
- Update `backend/models/thesisModel.js` and `backend/controllers/thesisController.js` to accept `department_id`.
- Write unit tests in `backend/tests/feed-filters.test.js`.

### Phase 2: Frontend Faceted Filter Bar
- Integrate `fetchDepartments` and `fetchCourses` into `frontend/app/(tabs)/index.tsx`.
- Wire `selectedDeptId` and `selectedCourseId` state into `fetchUnifiedFeed`.
- Render the faceted filter pills with SVG icons and active state highlights.
- Verify TypeScript check (`tsc --noEmit`) and full test suite.

