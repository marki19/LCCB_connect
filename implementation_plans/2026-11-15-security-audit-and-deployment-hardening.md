# Implementation Plan: Security Audit Remediation & Production Deployment Hardening

## Overview
Remediate security and operational defects identified in post-verification audit, harden authentication and cache controls, resolve the upload storage persistence question for Render, and configure production deployment files (`render.yaml`, `vercel.json`).

## Architecture Decisions
- **Allowlist Gate for `requireVerified`**: Treat staff roles (`faculty`, `departmentAdmin`, `admin`, `superadmin`) as pre-provisioned exemptions; all other accounts (specifically unverified `user` role) require `verification_status === "verified"` before performing write actions (posting, messaging, commenting).
- **Cache-Control Differentiation**: Private files (`theses`, `documents`) are flagged `Cache-Control: private, no-store` to prevent CDN and shared proxy leakage. Public media (`avatars`, `posts`, `videos`) retain long-term immutable caching.
- **Fail-Fast Boot Validation**: Validate all critical cryptographic secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `MFA_CHALLENGE_SECRET`, `DATABASE_URL`) in `backend/index.js` prior to requiring route modules.
- **Storage Strategy**: Consolidate storage architecture to ensure uploaded files survive production deployment and restarts (Render Persistent Disk vs Supabase Storage).

---

## Task List

### Phase 1: Security Critical Gates & Health Check (P1 Blockers)

#### Task 1: Invert `requireVerified` to an Allowlist
- **Description:** Replace denylist `role !== "student"` in `backend/middleware/auth.js` with an explicit staff allowlist so `user` role accounts are gated until identity verification is approved.
- **Acceptance criteria:**
  - `STAFF = new Set(["faculty", "departmentadmin", "admin", "superadmin"])` bypasses verification.
  - Accounts with role `user` or `student` receive `403 { code: "not_verified" }` unless `verification_status === "verified"`.
- **Verification:** Run `npm --prefix backend test` -> verification and auth suites pass.
- **Files touched:** `backend/middleware/auth.js`, `backend/tests/verification.test.js`.
- **Scope:** S (1-2 files).

#### Task 2: Align Profile-Completion Gates in Post and Message Controllers
- **Description:** Update `postController.js:82` and `messageController.js:99` so academic profile checks apply accurately to unverified roles rather than skipping non-students.
- **Acceptance criteria:**
  - Non-staff accounts must be verified or have completed profiles before creating posts or starting conversations.
- **Verification:** `node --test backend/tests/postModel.test.js` and `backend/tests/routes.test.js`.
- **Files touched:** `backend/controllers/postController.js`, `backend/controllers/messageController.js`.
- **Scope:** S (2 files).

#### Task 3: Restrict Private File Cache Headers
- **Description:** In `backend/routes/fileRouter.js`, branch cache headers so private categories (`theses`, `documents`) send `Cache-Control: private, no-store`, while public categories remain immutable.
- **Acceptance criteria:**
  - `GET /api/files/theses/:filename` returns `Cache-Control: private, no-store`.
  - `GET /api/files/avatars/:filename` returns `Cache-Control: public, max-age=31536000, immutable`.
- **Verification:** `node --test backend/tests/local-storage.test.js`.
- **Files touched:** `backend/routes/fileRouter.js`, `backend/tests/local-storage.test.js`.
- **Scope:** S (2 files).

#### Task 4: Fail-Fast Boot Secret Validation & .env.example Synchronization
- **Description:** Add `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MFA_CHALLENGE_SECRET` to `REQUIRED_ENV` in `backend/index.js`, and document all required deployment environment variables in `backend/.env.example`.
- **Acceptance criteria:**
  - Missing `JWT_SECRET` prints `[boot] Missing required environment variable(s): JWT_SECRET` and exits with code 1 before module evaluation.
  - `backend/.env.example` contains complete template for production variables.
- **Verification:** Run `node backend/index.js` without `JWT_SECRET` in isolated subshell and confirm clean exit code 1.
- **Files touched:** `backend/index.js`, `backend/.env.example`.
- **Scope:** S (2 files).

#### Task 5: Add Dedicated Health Check Endpoint
- **Description:** Add `GET /health` in `backend/app.js` that tests PostgreSQL pool connectivity and returns `{ status: "healthy" }` (200) or `{ status: "unhealthy" }` (503).
- **Acceptance criteria:**
  - `GET /health` responds 200 with status JSON on active DB connection.
  - Returns 503 if database pool fails query.
- **Verification:** Test with curl or supertest in `backend/tests/routes.test.js`.
- **Files touched:** `backend/app.js`, `backend/tests/routes.test.js`.
- **Scope:** S (2 files).

### Checkpoint 1: Security Foundation
- [ ] Verification tests pass
- [ ] Auth gates block unverified `user` role
- [ ] `/health` returns 200

---

### Phase 2: Auth Hardening & Hygiene (P2/P3 Fixes)

#### Task 6: Secure Logout Endpoint
- **Description:** Mount `auth.requireAuth` on `POST /api/auth/logout` in `backend/routes/authRouter.js`, and restrict token revocation strictly to authenticated `req.user.id`.
- **Acceptance criteria:**
  - `POST /api/auth/logout` returns 401 without valid bearer token.
  - Revokes refresh tokens only for the authenticated token subject.
- **Verification:** `node --test backend/tests/auth.test.js`.
- **Files touched:** `backend/routes/authRouter.js`, `backend/controllers/authController.js`.
- **Scope:** S (2 files).

#### Task 7: Remove Legacy Supabase Refresh Fallback
- **Description:** Delete `supabase.auth.refreshSession` fallback block in `backend/controllers/authController.js:1363-1376` so suspended accounts cannot mint sessions through legacy routes.
- **Acceptance criteria:**
  - Native refresh token handler is the sole authority for token refresh.
  - Suspended accounts receive 403 on refresh attempts without bypass.
- **Verification:** `node --test backend/tests/nativeAuth.test.js`.
- **Files touched:** `backend/controllers/authController.js`.
- **Scope:** XS (1 file).

#### Task 8: Fix Google OAuth Domain Gate Fail-Open
- **Description:** In `backend/controllers/authController.js:1100`, reject signups if email is missing or does not end with `@lccbonline.edu.ph` (`if (!email || !email.endsWith(...))`).
- **Acceptance criteria:**
  - Google accounts without an email or with non-LCCB domains are rejected with 403 `domain_not_allowed`.
- **Verification:** Unit test checking falsy email rejection.
- **Files touched:** `backend/controllers/authController.js`.
- **Scope:** XS (1 file).

#### Task 9: Strict TLS Certificate Enforcement in Production
- **Description:** In `backend/db.js`, throw error in production if `rejectUnauthorized` is enabled and CA certificate is absent, preventing silent fallback to insecure TLS.
- **Acceptance criteria:**
  - Production environment with `DATABASE_SSL_REJECT_UNAUTHORIZED=true` throws on missing certificate file.
- **Verification:** Run db test with simulated missing cert in test harness.
- **Files touched:** `backend/db.js`.
- **Scope:** XS (1 file).

#### Task 10: Dead File Cleanup & SQL ILIKE Sanitization
- **Description:** Delete obsolete `backend/controllers/authController.js.bak`, and escape wildcard characters (`%`, `_`) in `backend/routes/fileRouter.js` ILIKE queries.
- **Acceptance criteria:**
  - `backend/controllers/authController.js.bak` removed from repository.
  - `escapeLike` applied to filename parameters in `fileRouter.js`.
- **Verification:** Git status clean; `node --test backend/tests/local-storage.test.js` passes.
- **Files touched:** `backend/controllers/authController.js.bak` (delete), `backend/routes/fileRouter.js`.
- **Scope:** S (2 files).

### Checkpoint 2: Auth & Hygiene
- [ ] All 614 backend tests pass
- [ ] No `.bak` files remaining in tracked tree
- [ ] Logout requires authentication

---

### Phase 3: Storage Consolidation Decision

#### Task 11: Consolidate Upload Storage Architecture
- **Description:** Implement the chosen storage architecture:
  - *Path A (Render Disk)*: Configure persistent disk mount at `/var/data/uploads` in `render.yaml`, retain `localStorage.js`.
  - *Path B (Supabase Storage)*: Migrate upload writes in `uploadRouter.js` to `storageService.js` Supabase Storage buckets (`avatars`, `assets`, `theses`) and deprecate ephemeral local disk writes.
- **Acceptance criteria:**
  - Storage method cleanly supports persistent file uploads in production.
  - Zero split-brain between local disk and cloud storage.
- **Verification:** Upload test suite passes.
- **Files touched:** Dependent on choice (`render.yaml` OR `uploadRouter.js`, `storageService.js`).
- **Scope:** M (2-4 files).

---

### Phase 4: Production Deployment Configs

#### Task 12: Add Render Deployment Spec (`render.yaml`)
- **Description:** Create root `render.yaml` configuring web service, Node 24 runtime, build/start commands, environment variables, health check path `/health`, and disk mount if selected.
- **Acceptance criteria:**
  - `render.yaml` defines backend service with correct root directory, start command, and health check.
- **Verification:** Validate YAML syntax.
- **Files touched:** `render.yaml`.
- **Scope:** XS (1 file).

#### Task 13: Add Vercel SPA Configuration (`frontend/vercel.json`)
- **Description:** Create `frontend/vercel.json` with rewrite rule `[{"source": "/(.*)", "destination": "/index.html"}]` for Expo Router SPA routing.
- **Acceptance criteria:**
  - `frontend/vercel.json` maps all client routes to `/index.html`.
- **Verification:** Validate JSON schema.
- **Files touched:** `frontend/vercel.json`.
- **Scope:** XS (1 file).

#### Task 14: Final Pre-Deploy Verification Suite
- **Description:** Run full test suites (backend 614 tests, frontend vitest 38 tests, frontend `npx tsc --noEmit`).
- **Acceptance criteria:**
  - 100% test pass rate across backend and frontend.
  - 0 TypeScript compiler errors.
- **Verification:** `npm --prefix backend test` && `npm --prefix frontend run test` && `npm --prefix frontend run typecheck`.
- **Scope:** S (0 code changes, validation only).
