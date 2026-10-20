# Superadmin Console Tasks

Spec: `SPEC-superadmin-console.md`
Plan: `tasks/plan.md`

## Phase 1: Foundation

- [x] Task 1: Add migration 010 and sync `schema.sql`
  - Acceptance: audit table, suspension columns, indexes, RLS/revokes, and append-only trigger exist; `schema.sql` matches.
  - Verify: apply migration; `node scripts/audit-database.js`; inspect columns/trigger.
  - Files: `backend/migrations/010_superadmin_console.sql`, `backend/schema.sql`

- [x] Task 2: Add `supabaseAdmin`, `accountService`, and `auditService`
  - Acceptance: service-role client is lazy; ban/unban/revoke/delete work; audit writes are the only write path.
  - Verify: unit test audit insert; missing-key path returns 503 at the controller boundary.
  - Files: `backend/services/supabaseAdmin.js`, `backend/services/accountService.js`, `backend/services/auditService.js`

- [x] Task 3: Add `requireActiveAccount`, idempotent `loadProfile`, and shared admin validation
  - Acceptance: suspended profiles get 403 `account_suspended`; expired sanctions pass; `loadProfile` does not re-query.
  - Verify: focused middleware test; existing backend suite.
  - Files: `backend/middleware/auth.js`, `backend/validation/index.js`, `backend/tests/env.helper.js`

## Phase 2: Admin API

- [x] Task 4: Add `adminModel` read queries and `adminController`/`adminRouter`
  - Acceptance: overview, user list, dossier, content explorer, audit read; routes mounted before catalog.
  - Verify: supertest 200 for admin, 403 for student, shape assertions.
  - Files: `backend/models/adminModel.js`, `backend/controllers/adminController.js`, `backend/routes/adminRouter.js`, `backend/app.js`

- [x] Task 5: Add user governance actions
  - Acceptance: role/suspend/unsuspend/force-signout/delete follow the matrix and write audit rows.
  - Verify: rank/self/target tests; live suspension QA.
  - Files: `backend/controllers/adminController.js`, `backend/services/accountService.js`, `backend/validation/index.js`

- [x] Task 6: Add content explorer, thesis moderation, reasons, and audit hooks
  - Acceptance: hide/restore/delete all require reasons; delete is superadmin-only; theses covered; queue includes flagged theses.
  - Verify: moderation tests plus live hide/restore.
  - Files: `backend/controllers/moderationController.js`, `backend/models/thesisModel.js`, `backend/routes/moderationRouter.js`

- [x] Task 7: Add announcements
  - Acceptance: send to all/role/department, exclude suspended+sender, fan out notifications, count matches, history from audit.
  - Verify: supertest fan-out assertions; live student notification check.
  - Files: `backend/controllers/adminController.js`, `backend/models/adminModel.js`, `backend/models/notificationModel.js`

## Phase 3: Panel

- [x] Task 8: Rebuild shell, role guard, Back to App, app return link
  - Acceptance: desktop panel nav, admin-only guard, same-session back/return.
  - Verify: tsc; login as each role.
  - Files: `frontend/app/(admin)/_layout.tsx`, `frontend/app/_layout.tsx`, `frontend/app/(tabs)/_layout.tsx`, `frontend/src/lib/roles.ts`

- [x] Task 9: Build overview
  - Acceptance: real KPIs, needs-attention list, superadmin-only recent actions.
  - Verify: tsc; compare counts to SQL.
  - Files: `frontend/app/(admin)/index.tsx`, `frontend/src/lib/adminApi.ts`

- [x] Task 10: Build users table and dossier
  - Acceptance: search/filter/paginate; dossier actions and rank gating; reason dialogs.
  - Verify: tsc; superadmin/admin role QA.
  - Files: `frontend/app/(admin)/users/index.tsx`, `frontend/app/(admin)/users/[id].tsx`, `frontend/src/components/admin/*`

- [x] Task 11: Build Reports & Content
  - Acceptance: queue + library, reasons, delete gating, open in app.
  - Verify: tsc; hide/restore/delete QA.
  - Files: `frontend/app/(admin)/content.tsx`, `frontend/src/components/admin/*`

- [x] Task 12: Build Announcements and Audit
  - Acceptance: composer/count/history; audit filters + immutable display.
  - Verify: tsc; announcement and audit QA.
  - Files: `frontend/app/(admin)/announcements.tsx`, `frontend/app/(admin)/audit.tsx`

- [x] Task 13: Add suspended screen and AuthContext handling
  - Acceptance: suspended profile lands on `/suspended`; sign-out works.
  - Verify: suspend a test user, reload, unsuspend.
  - Files: `frontend/app/suspended.tsx`, `frontend/src/contexts/AuthContext.tsx`, `frontend/app/_layout.tsx`

## Phase 4: Release

- [x] Task 14: Harden legacy routes and migrate directory consumers
  - Acceptance: `/api/users` admin-only; app uses `/api/public/peers`; role writes and cross-user deletes closed.
  - Verify: tests; student home/settings/PeerPicker still load peers.
  - Files: `backend/routes/userRouter.js`, `backend/controllers/userController.js`, `frontend/app/(tabs)/index.tsx`, `frontend/app/settings.tsx`, `frontend/src/components/PeerPicker.tsx`

- [x] Task 15: Add backend tests and run role-by-role QA
  - Acceptance: `npm test`, tsc, lint, and the spec QA table pass.
  - Verify: commands + manual checklist.
  - Files: `backend/tests/admin.test.js`, `backend/tests/moderation.test.js`

- [x] Task 16: Update `DATABASE.md` and mark the spec implemented
  - Acceptance: live schema and console behavior documented.
  - Verify: docs match migration.
  - Files: `DATABASE.md`, `SPEC-superadmin-console.md`

## Checkpoints

- [x] After Tasks 1-3: backend tests pass, migration applied, schema audit clean
- [x] After Tasks 4-7: admin API tests pass, role gates verified
- [x] After Tasks 8-13: tsc clean; no new lint errors (26 pre-existing React-Compiler errors remain); all screens reachable
- [x] After Tasks 14-16: full role QA and docs complete

## Final verification (2026-10-20)

- Backend: `npm test` -> 180/180 passing.
- Frontend: `npx tsc --noEmit` clean. `npx expo lint` -> 26 errors, all pre-existing in the React-Compiler baseline; the admin console, admin API client, `ActionDialog`, `panelMode`, and suspended screen add none.
- Live API: admin overview 403 for student/deptadmin; deptadmin moderation queue 200; full audit 403 for admin; admin hide/restore allowed; admin hard delete 403; superadmin hard delete allowed; every mutation wrote the expected audit row; dossier sanctions show the actor username.
- Live suspension: a banned account's existing JWT is verified locally, its next non-self API request returns 403 `account_suspended`, its own profile still loads for the suspended screen, and unsuspend restores access. Force sign-out rejects the refresh token.
- Browser: desktop superadmin lands on the panel and sees Audit; desktop admin lands on the panel without Audit/delete/force; student/faculty/deptadmin land on the feed and `/users` or `/audit` redirects them home; mobile superadmin gets the feed and no Admin Console link; Back to App stays in the feed and Admin Console returns to the panel without re-login.
- Cleanup: 5 profiles, 1 department, 1 course, 0 posts, 0 comments, 0 notifications, 0 audit rows; the append-only trigger was re-enabled and verified.
