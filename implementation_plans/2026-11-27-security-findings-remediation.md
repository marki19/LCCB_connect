# Implementation Plan - Security Findings Remediation (H1, H2, M1-M5, LOW 1, 4, 5)

## Goal Description
Remediate the security vulnerabilities and integrity defects identified in the codebase audit:
1. **H1**: Enforce MFA server-side for all `/api/admin/*` endpoints via `requireAal2` and prevent refresh tokens from silently auto-elevating to AAL2.
2. **H2**: Invert and enforce content gating server-side in `requireContentAccess` so unapproved non-school/outsider accounts cannot bypass the guest review queue via direct API calls.
3. **M1**: Protect `/api/upload` with `requireContentAccess` and `requireVerified` so unverified/pending accounts cannot abuse storage.
4. **M2**: Protect `/api/snaps` with `requireContentAccess` so unapproved guests cannot browse snaps while pending in the review queue.
5. **M3**: Add `contact_scope` to `updateProfileSchema` so privacy updates succeed without 400 validation failures and surface errors if an update fails.
6. **M4**: Append guest declaration fields (`guest_declared_at`, `guest_purpose`, `guest_affiliation_type`, `guest_affiliation_name`, `guest_location`) to `PROFILE_COLUMNS` in `userModel.js` so review details render.
7. **M5**: Add centralized `isSchoolEmail()` on the frontend supporting `@lccb.edu.ph` and `@lccbonline.edu.ph` to remove the dead-end redirect loop.
8. **LOW 1, 4, 5**: Log logout token revocation failures, validate academic level updates, and sanitize link preview error strings.

---

## User Review Required
> [!IMPORTANT]
> **Admin MFA Enforcement (H1)**: Any admin or superadmin accessing `/api/admin/*` will strictly require a token with `aal: "aal2"`. Administrators without MFA enrolled will only be permitted to authenticate and access MFA enrollment routes (`/api/auth/mfa/*`). Refresh tokens will maintain their original AAL level rather than auto-elevating.

> [!WARNING]
> **Outsider Content Gate (H2)**: Any non-school email account (`!isSchoolAccount`) will be blocked by `requireContentAccess` with `403 guest_pending` on all content routes (`/api/posts`, `/api/users`, `/api/search`, `/api/friends`, etc.) until their guest declaration has been reviewed and approved by an administrator.

---

## Proposed Changes

### Component 1: Admin MFA Enforcement (H1)

#### [MODIFY] `backend/middleware/auth.js`
- Export `requireAal2(req, res, next)`:
  - Checks if user role is `admin` or `superadmin`.
  - Verifies `req.user?.aal === "aal2"`.
  - If `aal !== "aal2"`, returns `403` with `{ error: "MFA elevation required to access admin console", code: "mfa_required" }`.

#### [MODIFY] `backend/app.js`
- Update `adminMiddleware`:
  ```js
  const adminMiddleware = [
    auth.requireAuth,
    auth.loadProfile,
    auth.requireActiveAccount,
    auth.requireRole("admin", "superadmin"),
    auth.requireAal2,
  ];
  ```

#### [MODIFY] `backend/services/nativeAuth.js`
- Include `aal` in `refreshPayload` within `signTokens`:
  ```js
  const refreshPayload = {
    sub: user.id,
    jti,
    aal,
    token_type: "refresh",
    iat: nowSec,
    exp: refreshExpiresSec,
  };
  ```

#### [MODIFY] `backend/controllers/authController.js`
- In `refreshSession`:
  - Read `decoded.aal`. Set `const aal = decoded?.aal === "aal2" ? "aal2" : "aal1";`.
  - Remove logic that set `aal = "aal2"` solely because `hasVerifiedTotp` was true.
- In `challengeMfa`:
  - When MFA challenge passes, mint fresh session with `nativeAuth.signTokens(profile, { aal: "aal2" })`.
  - Revoke the pending session's refresh token and return the elevated session.
- In `mfaVerifyEnrollment`:
  - Sign and return elevated tokens with `aal: "aal2"` upon successful first-time enrollment.

---

### Component 2: Outsider Content Access Gate (H2)

#### [MODIFY] `backend/middleware/auth.js`
- Update `requireContentAccess`:
  - Keep exception: `if (req.method === "GET" && req.path === '/${req.user?.id}') return next();`.
  - Check email: `const email = req.profile?.email || req.user?.email || "";`.
  - Check school domain: `const isSchool = isSchoolAccount(email);`.
  - Check approval: `const isApproved = req.profile?.verification_status === "verified" || req.profile?.verification_status === "approved";`.
  - If `!isSchool || role === "guest"`, verify `isApproved`. If not approved, return `403` with `{ error: "Guest access is pending approval", code: "guest_pending" }`.

#### [MODIFY] `backend/controllers/authController.js`
- In `googleAuth`:
  - When creating a profile for a new user with `!isSchoolAccount(user.email)`:
    Set `role: "guest"` and `verification_status: "pending"`.

---

### Component 3: Storage & Media Gates (M1, M2)

#### [MODIFY] `backend/app.js`
- Protect `/api/upload`:
  ```js
  app.use(
    "/api/upload",
    auth.requireAuth,
    auth.loadProfile,
    auth.requireActiveAccount,
    auth.requireContentAccess,
    auth.requireVerified,
    uploadRouter
  );
  ```
- Protect `/api/snaps`:
  ```js
  app.use(
    "/api/snaps",
    auth.requireAuth,
    auth.loadProfile,
    auth.requireActiveAccount,
    auth.requireContentAccess,
    snapRouter
  );
  ```

---

### Component 4: Schema & Profile Consistency (M3, M4)

#### [MODIFY] `backend/validation/index.js`
- In `profileFields`:
  Add `contact_scope: z.enum(["public", "organization", "private"]).optional()`.

#### [MODIFY] `backend/models/userModel.js`
- In `PROFILE_COLUMNS`:
  Append:
  - `"guest_declared_at"`
  - `"guest_purpose"`
  - `"guest_affiliation_type"`
  - `"guest_affiliation_name"`
  - `"guest_location"`

#### [MODIFY] `frontend/app/settings.tsx`
- In `chooseContactScope`:
  If update fails, show error alert and revert `contactScope` back to previous value.

---

### Component 5: Domain Routing & School Email Recognition (M5)

#### [MODIFY] `frontend/src/lib/roles.ts`
- Export `isSchoolEmail(email?: string | null): boolean`:
  ```ts
  export const SCHOOL_EMAIL_DOMAINS = ["@lccbonline.edu.ph", "@lccb.edu.ph"];
  export function isSchoolEmail(email?: string | null): boolean {
    if (!email || typeof email !== "string") return false;
    const normalized = email.trim().toLowerCase();
    return SCHOOL_EMAIL_DOMAINS.some((d) => normalized.endsWith(d));
  }
  ```

#### [MODIFY] `frontend/app/_layout.tsx`
- Replace `!profile.email.endsWith("@lccbonline.edu.ph")` with `!isSchoolEmail(profile.email)`.

#### [MODIFY] `frontend/app/onboarding.tsx`
- Use `isSchoolEmail(profile?.email)` for `school_account` check.

---

### Component 6: Low-Risk Hygiene Fixes (LOW 1, 4, 5)

#### [MODIFY] `backend/controllers/authController.js`
- In logout and session revocation, log warning on `revokeAllUserRefreshTokens` error.

#### [MODIFY] `backend/validation/index.js` & `backend/routes/adminCatalogRouter.js`
- Add `academicLevelSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict()` on PUT `/academic-levels/:id`.

#### [MODIFY] `backend/controllers/postController.js`
- Replace raw `err.message` echo in `fetchLinkPreview` with `"Failed to generate link preview"`.

---

## Verification Plan

### Automated Tests
1. **MFA and Token Tests**:
   - `node --test backend/tests/mfa-challenge.test.js`
   - Test `requireAal2` blocking `aal1` and permitting `aal2` on `/api/admin/*`.
   - Test `refreshSession` preserving `aal1` without elevation.
2. **Guest and Content Access Tests**:
   - `powershell -Command '$env:ALLOW_REMOTE_TEST_DB="true"; node --test backend/tests/guestAccess.test.js'`
   - Assert non-school account without approval receives 403 `guest_pending` on content routes.
   - Assert upload and snaps endpoints return 403 for unverified/pending accounts.
3. **Type Check & Lint**:
   - `cd frontend && npx tsc --noEmit`
4. **Full Test Suite**:
   - `npm test` across all backend test suites.

### Manual Verification
1. Log in as an admin with only password (AAL1) -> verify `/api/admin/overview` returns 403 `mfa_required`.
2. Solve TOTP challenge -> verify `/api/admin/overview` returns 200 with AAL2 token.
3. Attempt direct curl to `/api/posts` using a non-school account without guest approval -> verify 403 `guest_pending`.
4. Check `frontend/app/settings.tsx` contact visibility updates -> verify no 400 error in console.
