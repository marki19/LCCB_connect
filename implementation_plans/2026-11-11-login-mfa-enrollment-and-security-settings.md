# Implementation Plan: Login MFA Enrollment, Instruction Setup, and Security Settings

## Goal Description
Implement a standard, user-friendly Multi-Factor Authentication (MFA/TOTP) architecture across LCCB Connect:
1. **Remove intrusive MFA blockers inside admin panels**: Remove `requireAal2` from `/api/admin` in `backend/app.js` so once an admin is logged in, they can browse the dashboard uninterrupted. Admin sessions remain protected by the 24-hour expiration (`checkSessionAge`) and role checks.
2. **First-Time / Unconfigured Login Flow**: If an admin (or user requiring MFA) does not have an authenticator factor yet, `login.tsx` prompts them with a clear, step-by-step setup modal with a downloadable/scannable QR code and manual setup key for Google Authenticator or Duo Mobile before asking for verification.
3. **Returning Daily Logins**: Returning admins and users with MFA configured see a standard 6-digit verification code pop-up on login without needing to re-scan.
4. **Student & Faculty Voluntary MFA**: MFA is OFF by default for students. A new "Security" modal accessed from the Settings sidebar (`SettingsSidebar.tsx`) allows students to voluntarily enable or disable MFA anytime.

---

## User Review Required

> [!IMPORTANT]
> **Admin Route Gating**: Removing `requireAal2` from `/api/admin` in `backend/app.js` shifts the enforcement from per-request admin API checks to the login gateway. Admins must complete MFA at login to get their session tokens, and their session expires automatically after 24 hours.

> [!NOTE]
> **QR Code Rendering**: The backend generates standard PNG data URLs via the `qrcode` package (`data:image/png;base64,...`). React Native's `<Image />` component renders this natively without adding new third-party dependencies.

---

## Proposed Changes

### Backend

#### [MODIFY] `backend/app.js`
- Remove `auth.requireAal2` from `adminMiddleware`.
- Retain `auth.requireAuth`, `auth.loadProfile`, `auth.requireActiveAccount`, `auth.requireRole("admin", "superadmin")`, and `auth.checkSessionAge`.

#### [MODIFY] `backend/controllers/authController.js`
- Ensure `login` returns `{ access_token, refresh_token, mfa_enrollment_required: true, user }` when an admin logs in without an enrolled factor, allowing the client to call `/api/auth/mfa/enroll` immediately.
- Ensure `mfaEnrollVerify` activates the factor and records audit events.
- Ensure `mfaList` (or `mfaFactors`) returns the user's active factors for the settings view.

---

### Frontend

#### [NEW] `frontend/src/components/auth/MfaSetupModal.tsx`
- Step-by-step modal for first-time MFA enrollment (used during admin onboarding or voluntary student activation):
  - **Step 1: Instructions**: Clear guidance to install Google Authenticator, Duo Mobile, or Microsoft Authenticator.
  - **Step 2: Scannable QR Code & Manual Key**: Renders the base64 QR code image and displays the secret key with a "Copy Key" button.
  - **Step 3: Verification**: 6-digit input box with "Verify & Activate" button.
  - Error messaging and loading states.

#### [NEW] `frontend/src/components/settings/SecuritySettingsModal.tsx`
- Opened from `SettingsSidebar.tsx` $\rightarrow$ "Security".
- Displays:
  - Account status and session policy (Admins: 24h, Students: 7d).
  - Two-Factor Authentication status (Disabled / Enabled).
  - "Enable Authenticator (Google Authenticator / Duo)" button opening `MfaSetupModal`.
  - "Disable Authenticator" button with confirmation prompt (`POST /api/auth/mfa/unenroll`).

#### [MODIFY] `frontend/src/lib/auth.ts`
- Update `signInWithIdentifier` to recognize and return `mfa_enrollment_required: true` responses.
- Export `enrollMfa()`, `verifyMfaEnrollment()`, `unenrollMfa()`, and `getMfaFactors()`.

#### [MODIFY] `frontend/app/(auth)/login.tsx`
- Detect `mfa_enrollment_required: true`: Open `MfaSetupModal` right after password submission so the user can scan the QR code and verify before proceeding.
- Detect `mfa_required: true`: Render the polished 6-digit TOTP challenge prompt for returning users.

#### [MODIFY] `frontend/src/components/SettingsSidebar.tsx`
- Connect line 295 (`<MenuItem icon={<Lock />} label="Security" />`) to open `SecuritySettingsModal`.

---

## Verification Plan

### Automated Tests
1. Backend test suite:
   ```bash
   cmd /c "cd backend && npm test"
   ```
2. Frontend TypeScript type check:
   ```bash
   cmd /c "cd frontend && npx tsc --noEmit"
   ```

### Manual Verification
1. **Admin Login without MFA (First-time)**:
   - Log in as an admin account that has no MFA factor.
   - Verify that instead of a raw 6-digit prompt, the **Setup Modal** opens with instructions, a visible QR code, and a secret key.
   - Scan with Google Authenticator or Duo Mobile.
   - Enter the generated 6-digit code.
   - Verify successful activation and redirection to admin dashboard.
2. **Admin Panel Navigation**:
   - Navigate across `/admin/overview`, `/admin/users`, `/admin/departments`.
   - Verify that requests succeed without any 403 `mfa_required` interruptions.
3. **Returning Admin Login**:
   - Log out and log back in with the same admin account.
   - Verify the direct 6-digit MFA prompt appears (no QR code needed).
4. **Student Settings**:
   - Log in as a student. Verify no MFA prompt on login.
   - Open Sidebar $\rightarrow$ Security.
   - Click "Enable Authenticator" $\rightarrow$ Verify QR code setup works.
   - Log out and log back in as student $\rightarrow$ Verify 6-digit MFA prompt appears.

