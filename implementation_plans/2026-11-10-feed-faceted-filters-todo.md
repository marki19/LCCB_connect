# Task List: Feed Faceted Filters

## Phase 1: Backend Filter Endpoints & Tests
- [x] Task 1.1: Add `departmentId` and `courseId` filters to `visiblePostsFor` in `backend/models/postModel.js`
- [x] Task 1.2: Parse and pass `department_id` and `course_id` in `backend/controllers/postController.js`
- [x] Task 1.3: Add `department_id` filter to `backend/models/thesisModel.js` and `backend/controllers/thesisController.js`
- [x] Task 1.4: Write unit tests in `backend/tests/feed-filters.test.js` and verify passing (403/403 backend tests pass)

## Phase 2: Frontend Faceted Filter Bar
- [x] Task 2.1: Add department & course state and live catalog fetching to `frontend/app/(tabs)/index.tsx`
- [x] Task 2.2: Pass `department_id` and `course_id` query parameters in `fetchUnifiedFeed`
- [x] Task 2.3: Render faceted filter pills (Department and cascaded Course rows) with 100% SVG icons
- [x] Checkpoint: Verify zero TypeScript errors (`tsc --noEmit`) and verify full test suite passes
