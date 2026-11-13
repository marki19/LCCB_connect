# Tasks: Group 2 — Correctness Bugs

Tracking implementation plan: [2026-11-13-group-2-correctness-bugs.md](file:///c:/Programming%20Projects/third-year/LCCB_connect/implementation_plans/2026-11-13-group-2-correctness-bugs.md)

---

## Task 1: Include `pinned` in Keyset Cursor Pagination
**Description:** Update `getAllPosts` and `visiblePostsFor` in `backend/models/postModel.js` so the cursor predicate includes `pinned` to avoid skipping or duplicating unpinned posts across page boundaries.

**Acceptance criteria:**
- [x] Parse `pinned|createdAt|id` in `getAllPosts` and `visiblePostsFor` (fallback to `pinned=false` for 2-part cursors).
- [x] Update keyset WHERE clause to compare `(pinned, created_at, id)`.
- [x] Add unit test verifying pinned-to-unpinned keyset traversal.

**Verification:**
- [x] Run: `cd backend && node --require dotenv/config --test tests/postModel.test.js` (PASSED: 11 tests)

**Dependencies:** None

**Files touched:**
- `backend/models/postModel.js`
- `backend/tests/postModel.test.js`

---

## Task 2: Eliminate N+1 Notification Inserts
**Description:** Replace the `for...of` sequential insert loop in `backend/services/notificationService.js` with a single multi-row `INSERT ... SELECT unnest($1::uuid[])`.

**Acceptance criteria:**
- [x] Single `db.query` execution for `createNotifications`.
- [x] Parameterized with array unnesting.

**Verification:**
- [x] Run: `cd backend && node --require dotenv/config --test tests/notificationService.test.js` (PASSED)

**Dependencies:** None

**Files touched:**
- `backend/services/notificationService.js`
- `backend/tests/notificationService.test.js`

---

## Task 3: Make `getTargetAdmins` Sargable
**Description:** Update `getTargetAdmins` in `backend/services/notificationService.js` to use exact roles and leverage the `department_id` index instead of non-sargable string functions.

**Acceptance criteria:**
- [x] Replace `LOWER(REPLACE(REPLACE(...)))` with exact role comparison `role IN (...)`.
- [x] Query executes cleanly without table scan.

**Verification:**
- [x] Run: `cd backend && node --require dotenv/config --test tests/notificationService.test.js` (PASSED)

**Dependencies:** None

**Files touched:**
- `backend/services/notificationService.js`
- `backend/tests/notificationService.test.js`

---

## Task 4: End-to-End Suite Verification
**Description:** Verify zero regressions across the backend test suite and frontend typecheck.

**Acceptance criteria:**
- [x] All 536 backend tests passing: `cd backend && node --require dotenv/config --test` (PASSED: 536 passed, 0 failed, 134 suites)
- [x] Frontend TypeScript type check: 0 errors (`cd frontend && npx tsc --noEmit`) (PASSED)

**Verification:**
- [x] `cd backend && node --require dotenv/config --test` (536 pass, 0 fail, 134 suites)
- [x] `cd frontend && npx tsc --noEmit` (0 errors)

**Dependencies:** Tasks 1, 2, 3

**Files touched:** None
