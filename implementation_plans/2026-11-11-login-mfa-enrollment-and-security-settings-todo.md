# Task List: Login MFA Enrollment, Instruction Setup, and Security Settings

## Phase 1: Backend Middleware & API Alignment
- [x] Task 1: In `backend/app.js`, remove `auth.requireAal2` from `/api/admin` middleware stack so admin panels do not block active sessions.
- [x] Task 2: In `backend/controllers/authController.js`, verify `login` sends `mfa_enrollment_required: true` and active session tokens for first-time admin setup; ensure `mfaEnroll`, `mfaEnrollVerify`, and `mfaUnenroll` respond cleanly.

## Checkpoint: Phase 1
- [x] Backend tests pass and `/api/admin` operates without per-request `requireAal2` blocking.

## Phase 2: Frontend MFA API Client & Types
- [x] Task 3: In `frontend/src/lib/auth.ts`, add types and functions for `enrollMfa()`, `verifyMfaEnrollment()`, `unenrollMfa()`, `getMfaFactors()`, and update `signInWithIdentifier` to return `mfa_enrollment_required`.

## Checkpoint: Phase 2
- [x] Frontend compiles with all MFA API methods typed.

## Phase 3: MFA Setup Modal & First-Time Onboarding
- [x] Task 4: Create `frontend/src/components/auth/MfaSetupModal.tsx` displaying step-by-step instructions, authenticator recommendations (Google Authenticator / Duo), QR code image, manual key with copy button, and 6-digit confirmation code input.
- [x] Task 5: In `frontend/app/(auth)/login.tsx`, handle `mfa_enrollment_required: true` by popping up `MfaSetupModal` right after password entry.

## Checkpoint: Phase 3
- [x] Admins without MFA get the setup modal with QR code on login; returning admins get the 6-digit challenge box.

## Phase 4: Student & Faculty Security Settings
- [x] Task 6: Create `frontend/src/components/settings/SecuritySettingsModal.tsx` to display 2FA status, session lifetime (24h/7d), Enable 2FA button (opens `MfaSetupModal`), and Disable 2FA button.
- [x] Task 7: Connect the "Security" menu item in `frontend/src/components/SettingsSidebar.tsx` to open `SecuritySettingsModal`.

## Checkpoint: Phase 4
- [x] Students can voluntarily enable or disable 2FA from the Settings sidebar.

## Phase 5: Verification & Polish
- [x] Task 8: Run `cmd /c "cd frontend && npx tsc --noEmit"` and verify 0 errors.
- [x] Task 9: Run `cmd /c "cd backend && npm test"` and verify test suite passes.

## Phase 6: Superadmin MFA Enforcement & Routing Guard Fix
- [x] Task 10: In `frontend/src/lib/auth.ts`, do NOT install session prematurely when `mfa_enrollment_required: true`. Pass temporary token to `enrollMfa` and `verifyMfaEnrollment`.
- [x] Task 11: In `frontend/src/lib/api.ts`, preserve explicit `Authorization` headers when provided.
- [x] Task 12: In `frontend/app/(auth)/login.tsx`, hold pending tokens in state; install session only after `MfaSetupModal` verification succeeds, preventing premature `_layout.tsx` RouteGuard redirection to `/(admin)/`.
- [x] Task 13: In `backend/controllers/authController.js`, add matching MFA challenge & admin enrollment enforcement to `googleAuth`.
- [x] Task 14: In `backend/app.js`, restore `auth.requireAal2` in `adminMiddleware` for network-level defense-in-depth.
