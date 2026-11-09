# LCCB Connect — Unfinished Work Scan

**Date:** 2026-11-07
**Scope:** `backend/`, `frontend/`, repo docs, plan files (`implementation_plans/`)
**Method:** read-only scan + live verification (backend suite, tsc, lint, DB queries, npm audit)

---

## 0. Verdict

Nothing is broken at build level. The repo compiles, tests pass, and the live database is consistent.

What is unfinished is **planned work that was never started**, **status documents that are stale**, and **test residue in the live database**.

| Area | State |
|---|---|
| Backend tests | 296/296 pass |
| Frontend typecheck | clean (`tsc --noEmit`) |
| Frontend lint | 0 errors, 6 warnings |
| Live DB integrity audit | passes |
| Backend npm audit | 0 vulnerabilities |
| Frontend npm audit | 14 vulnerabilities (1 critical, 4 high) |
| Ghost Auth users | 0 |
| Orphan profiles | **22** (test residue) |
| Uncommitted changes | 5 files |

---

## 1. Implementation plans — status

### 1.1 NOT STARTED — Reverse signup + ghost account cleanup

- **File:** `implementation_plans/2026-11-06-reverse-signup-ghost-cleanup.md`
- **Task list:** `implementation_plans/2026-11-06-reverse-signup-ghost-cleanup-todo.md` (9 items, all unchecked)
- **Evidence it is unstarted:** no `pending_signups` table in the live DB (`to_regclass` → `null`); highest migration is `017`; `requestSignup` still calls `supabase.auth.admin.createUser` at `backend/controllers/authController.js:248`.
- **6 tasks pending:**
  1. Migration `018_pending_signups.sql`
  2. `requestSignup` → store pending record, hash password, generate OTP
  3. `verifySignup` → create Auth user + profile after OTP success
  4. Cleanup job: pending signups older than 24 h
  5. Cleanup job: ghost Auth users (no profile, older than 24 h)
  6. Validation + test updates

### 1.2 IMPLEMENTED, CHECKLIST NEVER TICKED — Auth / OTP / onboarding / verification

- **File:** `implementation_plans/2026-11-06-lccb-auth-onboarding-verification.md`
- 43 unchecked boxes, but the artifacts exist:
  - `backend/migrations/016_identity_verification.sql`, `017_verification_birthdate.sql`
  - `backend/routes/verificationRouter.js`, `controllers/verificationController.js`, `models/verificationModel.js`
  - `backend/middleware/auth.js:305` `requireVerified`
  - `frontend/app/onboarding.tsx`, `frontend/app/verify-requests.tsx`, `(auth)/verify-email.tsx`, `(auth)/forgot-password.tsx`, `(auth)/reset-password.tsx`
  - tests: `verification.test.js`, `verificationGate.test.js`, `login.test.js`
- **Action:** tick the checklist or mark the plan superseded. Do not re-implement.
- **Explicitly deferred in this plan:** MFA (§3). Not a gap, a decision.

### 1.3 PARTIALLY IMPLEMENTED — Security auth / media / visibility

- **File:** `implementation_plans/2026-11-04-lccb-security-auth-media-visibility.md`
- Phases 0–3 shipped: migrations `014_content_visibility.sql`, `015_storage_private_buckets.sql`; `visibility` columns on `posts`/`theses`; buckets `assets`/`theses` private, `avatars` public; `visibilityService.js`, `storageService.js`.
- **Not built (deferred by decision):**
  - Phase 4 MFA — superseded by the 2026-11-06 plan
  - Phase 5 Google OAuth — never built
  - Phase 6 adaptive device/network challenge — stretch, never built
- Also flagged and still true: `app.set('trust proxy', N)` is unset (pentest finding #6).

### 1.4 COMPLETE, PLAN FILE STALE — Superadmin console

- `implementation_plans/superadmin-console-todo.md`: all 16 tasks + 4 checkpoints checked, final verification recorded 2026-10-20.
- `implementation_plans/superadmin-console-plan.md`: **all 16 tasks still show `[ ]`**. The plan was never reconciled after the build.
- **Action:** tick `implementation_plans/superadmin-console-plan.md` or delete it (the todo is the record of truth).

### 1.5 OUT OF SCOPE — Other local plans

- `2026-10-29-lafvin-qr-controller.md` — LAFVIN robot QR controller. Different project, not this repo.
- `radeonchill-2026-10-27.md` — unrelated.
- Neither should be tracked as LCCB Connect work.

### 1.6 STALE PROPOSAL DOC — `Feature_suggestions.md`

Status says "Proposed", but A1–A9 (search, pagination, notifications, comments edit/delete, bookmarks, follows, messaging, verified onboarding, admin toolkit) are largely shipped. The doc now misrepresents remaining scope.

---

## 2. Backend — unfinished work

### 2.1 Signup creates Auth user before OTP verification

- `backend/controllers/authController.js:248` — `admin.createUser({ email, password, email_confirm: false })` at request time.
- Profile is created only after verification (`authController.js:161`), so login stays blocked, but the Auth row exists pre-verification.
- This is the exact thing the reverse-signup plan (§1.1) exists to fix.

### 2.2 Signup rate limiter removed in uncommitted changes (regression)

- `backend/middleware/loginLimits.js` — `requestSignupLimiter` deleted.
- `backend/routes/authRouter.js` — limiter no longer mounted on `/request-signup`.
- Without it, an unauthenticated caller can spam signup requests. The reverse-signup plan assumes **3 per 10 minutes per email**.
- **Action:** restore the limiter when the reverse flow lands, or restore it now.

### 2.3 No scheduled cleanup jobs

- `backend/scripts/prune.js` exists (retention sweep) but nothing schedules it — no cron, no `setInterval`, no external scheduler config in the repo.
- No ghost-account cleanup exists at all (see §1.1, tasks 4–5).
- **Consequence:** retention and ghost cleanup depend on someone running scripts manually.

### 2.4 `schema.sql` out of sync with migration 017

- `backend/migrations/017_verification_birthdate.sql` adds `profile_verification_requests.birthdate`.
- `backend/schema.sql` has the table but **no `birthdate` column**.
- **Action:** add the column to `schema.sql` (or regenerate the file).

### 2.5 Missing endpoints (documented, intentional)

From `docs/BACKEND_CONTRACT.md` §11 / `docs/API-REQUESTS.md`:

| # | Gap | Blocks |
|---|---|---|
| 1 | Admin/system settings read + update | `(admin)/settings.tsx` (API-REQ-001, Open) |
| 2 | Storage cleanup / media library | Deleting a post leaves its image in Storage (thesis PDFs are cleaned) |
| 3 | Non-admin role filter on `/public/peers` | Directory filtering (API-REQ-011, Partial) |
| 4 | Faculty adviser review / thesis approval workflow | Faculty-specific screens |
| 5 | Bookmarks, content reports, announcement edit/delete, group DMs, notification prefs, friend suggestions, bulk actions, thesis analytics, device-token listing | Feature backlog (API-REQ-004…017) |

### 2.6 Storage cleanup only covers theses

- `backend/controllers/thesisController.js:234` deletes the PDF on thesis delete.
- `backend/controllers/postController.js` does **not** delete post images. `implementation_plans/post-audit-fixes.md` still lists this as remaining; it is half-done.

### 2.7 Seed script produces unverified accounts

- `backend/scripts/seed-test-users.js:147` inserts profiles without `verification_status`, so it defaults to `unverified`.
- Live state confirms all 5 role accounts are `unverified`:
  - `student@lccbonline.edu.ph` → `student`, unverified
  - `faculty@…`, `deptadmin@…`, `admin@…`, `superadmin@…` → unverified
- Staff are exempt from the write gate (D12), but the seeded **student cannot post/message/upload** until approved. Decide: mark seeded roles verified, or keep the student unverified to demo onboarding.

---

## 3. Frontend — unfinished work

### 3.1 Admin Settings screen is an orphaned stub

- `frontend/app/(admin)/settings.tsx` renders "Not available yet. / No settings API exists."
- It is not linked in the sidebar (`frontend/app/(admin)/_layout.tsx` nav lists Overview, Users, Content, Announcements, Departments, Audit only).
- Still reachable by direct URL. Either build the API + screen, or delete the route.

### 3.2 Debug route is exposed

- `frontend/app/debug/errors.tsx` is a live route (`/debug/errors`) that renders `ErrorDisplay`. No guard. Remove or gate before release.

### 3.3 Push delivery not verified end-to-end

- Code is complete (`backend/services/pushService.js`, `frontend/src/lib/push.ts`, `expo-notifications` plugin).
- No `frontend/eas.json`, no dev build, no FCM/APNs credentials.
- **Consequence:** background push has never been observed on a device (documented in `implementation_plans/Messaging_plan.md` Phase 5).

### 3.4 Frontend dependency vulnerabilities

- `npm audit --omit=dev`: **14 total** (1 critical, 4 high, 8 moderate, 1 low). Down from 37 but still open.
- Mostly Expo/Metro/build-time packages per the pentest report.

### 3.5 Frontend has no tests

- `frontend/package.json` has no `test` script and no test runner.
- Desloppify flags `no_test_suite` and `critical_paths_untested`.

### 3.6 Lint warnings

- `npx expo lint`: 0 errors, 6 warnings.
- Notable: unused `withTiming` (`app/index.tsx:6`), unused `err` (`src/lib/push.ts:105`), axios named-export cautions in `src/lib/api.ts`.

---

## 4. Live database findings

| Check | Result |
|---|---|
| `auth.users` | 5 total, 0 unconfirmed |
| Ghost Auth users (no profile) | **0** |
| Profiles | 27 (22 verified, 5 unverified) |
| Profiles with no Auth user | **22 — all `role = admin`, random `admin_<suffix>@lccbonline.edu.ph`, created 2026-11-06/07** |
| Content owned by orphan profiles | 0 posts, 0 theses |
| Pending verification requests | 0 |
| `pending_signups` table | does not exist |

The 22 orphan profiles are test residue. They have no content and no Auth user, but they inflate the user directory and the admin user list. `verification.test.js` cleans up its own data; whatever creates these does not.

**Action:** identify the test that inserts `admin_<suffix>` profiles, add cleanup, and delete the 22 rows.

---

## 5. Uncommitted work (5 files)

```
backend/middleware/loginLimits.js      -21   (requestSignupLimiter removed)
backend/routes/authRouter.js            -4   (limiter unmounted)
frontend/app/(auth)/login.tsx          +/-   (landscape layout)
frontend/app/(auth)/register.tsx       +/-   (landscape layout)
frontend/src/lib/api.ts                 +6   (JSON Content-Type when body is string)
```

Three of these are good changes (landscape, Content-Type). One is a security regression (§2.2). Nothing is committed yet.

---

## 6. Stale status documents

| File | Problem |
|---|---|
| `implementation_plans/superadmin-console-plan.md` | All 16 superadmin tasks unchecked though the todo shows them done |
| `implementation_plans/Security_plan.md:3` | Says "6 partial — no buckets yet" (buckets exist) and "7 deploy pending" (function returns 401, i.e. deployed) |
| `implementation_plans/post-audit-fixes.md:35` | "Add Storage cleanup when a thesis is deleted" — implemented in `thesisController.js:234` |
| `implementation_plans/post-audit-fixes.md:34` | "Implement admin Settings or remove nav link" — link removed, screen remains (see §3.1) |
| `DATABASE.md` | Last touched 2026-11-02; does not document migrations 016/017 (verification tables, birthdate) |
| `Feature_suggestions.md` | Still "Proposed" though most items shipped |
| `docs/API-REQUESTS.md` API-REQ-013 | Says no storage cleanup exists; thesis cleanup now exists |

---

## 7. Repo hygiene

- `expressboky-main/` — 11 tracked files from an unrelated Express project (`controller/`, `controllers/`, `routes/`, `db.js`, `index.js`, `package.json`). Dead code in the repo root.
- `src/theme/colors.ts` — tracked stray file at repo root; the real frontend theme lives in `frontend/src/`.
- `frontend/supabase/functions/link-preview/` — source present and **deployed** (POST returns `401 UNAUTHORIZED_NO_AUTH_HEADER`). Keep; update the stale doc note.
- `.desloppify/plan.json` — 62 queued frontend code-health findings (33 categories). Not a plan to execute blindly; treat as a refactor backlog. Top themes: API pass-through wrappers, duplicate API clients (`api.ts` vs `adminApi.ts`), oversized `ThemeContext`/`_layout`/`tabs/index` modules, missing frontend tests.

---

## 8. Recommended order

1. **Decide on reverse signup** — approve and implement `2026-11-06-reverse-signup-ghost-cleanup.md`, which also restores signup rate limiting and adds the 24 h cleanup. (~1–1.5 days)
2. **Clean the live DB** — delete the 22 orphan admin profiles; fix the test that creates them; decide seeded-account verification status. (~30 min)
3. **Reconcile stale docs** — `implementation_plans/superadmin-console-plan.md`, `implementation_plans/Security_plan.md`, `implementation_plans/post-audit-fixes.md`, `DATABASE.md`, `schema.sql` birthdate. (~1 hour)
4. **Close the frontend stubs** — build or delete `(admin)/settings.tsx`; remove or gate `/debug/errors`. (~2 hours)
5. **Schedule retention + cleanup** — run `scripts/prune.js` and the new ghost cleanup on a real scheduler. (~1 hour)

Separately, and not blocking: frontend dependency upgrade, push EAS build, post-image storage cleanup, and the 14 API-REQ backlog items.
