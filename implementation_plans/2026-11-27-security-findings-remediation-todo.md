# Task List - Security Findings Remediation

- [x] 1. Enforce Server-Side MFA on Admin Endpoints (H1)
  - [x] 1.1 Add `requireAal2` in `backend/middleware/auth.js`
  - [x] 1.2 Mount `requireAal2` on `adminMiddleware` in `backend/app.js`
  - [x] 1.3 Embed `aal` into `refreshPayload` in `backend/services/nativeAuth.js`
  - [x] 1.4 Update `refreshSession` in `backend/controllers/authController.js` to preserve token AAL without auto-elevation
  - [x] 1.5 Update `challengeMfa` and `mfaVerifyEnrollment` to return elevated AAL2 session tokens

- [x] 2. Gate Outsiders at the API Level (H2)
  - [x] 2.1 Update `requireContentAccess` in `backend/middleware/auth.js` to require approval for non-school accounts and guest roles
  - [x] 2.2 Update `googleAuth` in `backend/controllers/authController.js` to set `role: 'guest'` and `verification_status: 'pending'` for new non-school accounts

- [x] 3. Gate Storage and Snaps (M1, M2)
  - [x] 3.1 Add `requireContentAccess` and `requireVerified` to `/api/upload` in `backend/app.js`
  - [x] 3.2 Add `requireContentAccess` to `/api/snaps` in `backend/app.js`

- [x] 4. Fix Schemas and Return Values (M3, M4)
  - [x] 4.1 Add `contact_scope` to `profileFields` in `backend/validation/index.js`
  - [x] 4.2 Append `guest_*` columns to `PROFILE_COLUMNS` in `backend/models/userModel.js`
  - [x] 4.3 Handle errors and state revert in `frontend/app/settings.tsx`

- [x] 5. Fix School Email Routing (M5)
  - [x] 5.1 Export `isSchoolEmail` in `frontend/src/lib/roles.ts`
  - [x] 5.2 Update `frontend/app/_layout.tsx` and `frontend/app/onboarding.tsx` to use `isSchoolEmail`

- [x] 6. Low-Risk Cleanups (LOW 1, 4, 5)
  - [x] 6.1 Log error in `authController.js` token revoking catch
  - [x] 6.2 Add validation for academic levels update in `backend/routes/adminCatalogRouter.js`
  - [x] 6.3 Sanitize link preview error return in `backend/controllers/postController.js`

- [x] 7. Verification & Testing
  - [x] 7.1 Run backend test suite (`node --test`)
  - [x] 7.2 Run frontend typecheck (`npx tsc --noEmit`)
