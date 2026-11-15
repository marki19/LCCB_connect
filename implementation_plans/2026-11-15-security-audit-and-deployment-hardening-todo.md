# Task List: Security Audit Remediation & Production Deployment Hardening

## Phase 1: Security Critical Gates & Health Check (P1 Blockers)
- [x] Task 1: Invert `requireVerified` to allowlist (`backend/middleware/auth.js`)
- [x] Task 2: Align profile-completion gates in `postController.js` and `messageController.js`
- [x] Task 3: Restrict private file cache headers (`backend/routes/fileRouter.js`)
- [x] Task 4: Fail-fast boot secret validation & `.env.example` update (`backend/index.js`, `backend/.env.example`)
- [x] Task 5: Add dedicated health check endpoint `GET /health` (`backend/app.js`)

## Checkpoint 1: Security Foundation
- [x] Verification tests pass
- [x] Auth gates block unverified `user` role
- [x] `/health` returns 200

## Phase 2: Auth Hardening & Hygiene (P2/P3 Fixes)
- [x] Task 6: Secure logout endpoint with `requireAuth` (`backend/routes/authRouter.js`, `backend/controllers/authController.js`)
- [x] Task 7: Remove legacy Supabase refresh fallback (`backend/controllers/authController.js`)
- [x] Task 8: Fix Google OAuth domain gate fail-open (`backend/controllers/authController.js`)
- [x] Task 9: Strict TLS certificate enforcement in production (`backend/db.js`)
- [x] Task 10: Delete `backend/controllers/authController.js.bak` & escape ILIKE in `fileRouter.js`

## Checkpoint 2: Auth & Hygiene
- [x] All 616 backend tests pass
- [x] No `.bak` files remaining in tracked tree
- [x] Logout requires authentication

## Phase 3: Storage Consolidation Decision
- [ ] Task 11: Consolidate storage architecture (Render Disk vs Supabase Storage)

## Phase 4: Production Deployment Configs
- [ ] Task 12: Add Render deployment spec (`render.yaml`)
- [ ] Task 13: Add Vercel SPA configuration (`frontend/vercel.json`)
- [ ] Task 14: Final pre-deploy verification suite (Backend 614 tests, Frontend typecheck & vitest)
