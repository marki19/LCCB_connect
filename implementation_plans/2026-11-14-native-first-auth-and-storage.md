# Implementation Plan: Native-First Client Auth & Private File Authorization

Self-hosted independence: transition authentication and session lifecycle to native Node/Postgres and native client storage, secure private file downloads, and enforce token revocation.

## Scope & Milestones

### C1 — Security Hardening (Backend Only)
1. **Explicit Profile Columns**: In `backend/models/userModel.js`, define `PROFILE_COLUMNS` excluding `password_hash`. Use it in `getAllUsers`, `getUserById`, `updateUser`, `deleteUser`.
2. **Serialization Sanitizer**: Create `backend/utils/profile.js` with `sanitizeProfile(row)` removing `password_hash`. Wire into `authController.js` responses.
3. **Serialization Test**: `backend/tests/profile-serialization.test.js` verifying no endpoint ever leaks `password_hash`.
4. **Strict JWT Secret**: In `backend/services/nativeAuth.js`, throw at load if `JWT_SECRET` is unset (skip when `NODE_ENV === "test"`). Remove literal and Supabase fallbacks.
5. **Private File Authorization**: In `backend/routes/fileRouter.js`, require auth for `theses` and `documents`. Verify ownership (thesis uploader, post author, or profile owner); return 404 otherwise. Avatars and posts remain public.
6. **Open Risks Fixes (Part 1)**:
   - In `backend/controllers/authController.js` (`verifySignup`), restore `role: pending.role || "student"`.
   - In `backend/services/nativeAuth.js`, log if Supabase mirror sync fails during signup.

### C2 — Token Lifecycle & Revocation (Backend)
1. **Migration 046**: `backend/migrations/046_refresh_tokens.sql` creating `refresh_tokens (jti TEXT PK, user_id TEXT, expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ)` + index on `user_id`, and `DROP DEFAULT ON email_confirmed_at`.
2. **TTL & Token Rotation**:
   - `nativeAuth.signTokens`: Access token TTL 15 min, refresh TTL 30 days. Persist `jti` in `refresh_tokens`.
   - `refreshSession`: Verify JWT -> query `refresh_tokens` by `jti` -> reject if missing/revoked/expired -> rotate (revoke old `jti`, insert new `jti`) -> re-verify lock/suspension/MFA.
   - `logout`: Revoke all refresh tokens for caller.
   - `accountService.revokeSessions` & suspension: Revoke active refresh tokens.
3. **Schema Baseline**: Update `backend/init-schema.sql` to include `refresh_tokens` and set `_migrations` baseline to 046.

### C3 — Client Native-First (Frontend)
1. **Session Store**: `frontend/src/lib/session.ts` using `expo-secure-store` on native and `localStorage` on web with `getSession`, `setSession`, `clearSession`, `subscribe`, and expiry checks.
2. **Auth Integration**:
   - Update `frontend/src/lib/auth.ts`: `installSession` saves to `session.ts`; add `refreshSession()` calling `POST /api/auth/refresh`.
   - Backend `sendTokens`: Ensure response includes `user.id`.
3. **API Client Auto-Refresh**: Update `frontend/src/lib/api.ts` to attach bearer token from `session.ts`. On 401, perform single refresh and retry once.
4. **Context & Sidebar**:
   - Update `frontend/src/contexts/AuthContext.tsx` to subscribe to `session.ts`, derive user, and logout via `POST /api/auth/logout`.
   - Update `frontend/src/components/navigation/SettingsSidebar.tsx` logout handler.
5. **Unit Tests**: Update `auth.test.ts`, `api.test.ts`, and `AuthContext.test.tsx` against native session store.

### C4 — Repo Hygiene & Verification
1. **Migration Runner**: In `backend/scripts/migrate.js`, only close DB pool when run directly as entry point.
2. **Unused Imports**: In `frontend/src/lib/upload.ts`, clean up unused Supabase imports.
3. **Verification**: Backend tests 0 fail, frontend `tsc --noEmit` exit 0, vitest 100% pass.
