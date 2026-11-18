# Implementation Plan - Remove Conflicting Admin Session Gate

## Goal
Eliminate the conflicting 24-hour admin session gate implementations across `app.js` middleware, `authController.js` endpoints, and `(admin)/_layout.tsx` so administrators can browse the console without false session expiration or failed step-up loops. MFA remains enforced at the login gateway.

## Proposed Changes

### Backend
1. **`backend/app.js`**: Drop `auth.checkSessionAge` from `adminMiddleware`. Console gate is: `requireAuth → loadProfile → requireActiveAccount → requireRole("admin", "superadmin")`.
2. **`backend/controllers/authController.js`**:
   - Delete `mfaStepUp` and `checkAdminSession` and remove from `module.exports`.
   - Remove `mfaService.clearSessionAgeCache(userId)` calls in `login`, `mfaEnrollVerify`, and `logout`.
3. **`backend/routes/authRouter.js`**: Delete routes `POST /mfa/step-up` and `GET /mfa/admin-session` and controller imports.
4. **`backend/services/mfaService.js`**: Delete `requireAal2`, `checkSessionAge`, `clearSessionAgeCache` and remove from `module.exports`.
5. **`backend/middleware/auth.js`**: Delete destructuring and re-exports of `requireAal2`, `checkSessionAge`, `clearSessionAgeCache`.
6. **`backend/tests/`**:
   - Delete `tests/mfa-stepup.test.js` and `tests/mfa-session.test.js`.
   - Strip `checkSessionAge`/`requireAal2` stub pairs from `admin.test.js`, `catalog.test.js`, `directory.test.js`, `feed-filters.test.js`, `login-security.test.js`, and `peer-profile.test.js`.

### Frontend
7. **`frontend/app/(admin)/_layout.tsx`**:
   - Remove `sessionChecking`, `sessionExpired`, `sessionKey`, `mfaCode`, `mfaBusy`, `mfaError`, `checkSession`, both `useEffect` hooks, `handleUnlockSession`.
   - Remove `if (sessionExpired)` block.
   - Guard becomes `if (!profile)`.
   - Remove `key={sessionKey}` on `<Stack />`.
   - Remove unused imports.
8. **`frontend/src/lib/adminApi.ts`**: Delete `checkAdminSessionStatus` and `stepUpAdminMfa`.
9. **`frontend/src/lib/api.ts`**: Remove `admin_session_expired` CustomEvent dispatch in 401 interceptor.
10. **`frontend/app/(admin)/index.tsx`**: Simplify error card in empty state to use WifiOff / "Signal lost" / "Try again".
11. **`frontend/src/components/leftrail/DesktopLeftRail.tsx` & `frontend/src/components/topbar/AccountPopover.tsx`**: Remove `checkAdminSessionStatus` and `AdminMfaPromptModal` invocation. Delete unused `frontend/src/components/admin/AdminMfaPromptModal.tsx`.

## Verification Gates
- Backend test suite: ~703 tests passing (737 minus 34 removed tests)
- Frontend vitest: 64/64 passing
- TypeScript: `tsc` exit 0
- ESLint: <= 63 errors / 142 warnings (no regressions)
