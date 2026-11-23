# Task List: Guest / Outsider Account Implementation

Plan Reference: [guest_outsider_account_plan.md](./guest_outsider_account_plan.md)

- [ ] Task 1: Database Migration (062_guest_access_requests.sql)
  - Create table `guest_access_requests` with indexes.
  - Alter `profiles` with columns: `guest_declared_at`, `guest_purpose`, `guest_affiliation_type`, `guest_affiliation_name`, `guest_location`.

- [ ] Task 2: Backend Policy & Model
  - `backend/utils/roles.js`: Export `DECLARATION_ROLES = ["guest"]`.
  - `backend/services/verificationPolicy.js`: Add `DECLARATION_ROLES`, update `needsRoleChoice` so `canonical !== ROLES.GUEST`, add `guest` to `REVIEWER_SCOPE` (admin & superadmin, `byDepartment: false`), `fieldsFor('guest') = null`.
  - `backend/models/guestAccessModel.js`: Implement `createRequest`, `getPendingForUser`, `listRequests`, `approve`, `decline`.

- [ ] Task 3: Backend Controllers & Endpoints
  - `backend/controllers/authController.js`: Include `account_kind` in googleAuth and signup responses.
  - `backend/models/userModel.js`: Include `account_kind` and `contact_scope` in user responses; respect `contact_scope` in `getPublicProfile`.
  - `backend/controllers/guestDeclarationController.js` & route `POST /auth/guest`.
  - `backend/controllers/verificationController.js` & `backend/routes/verificationRouter.js`: Support `kind=guest` in `listRequests`, `approve`, and `decline`.

- [ ] Task 4: Content Gate Middleware
  - `backend/middleware/auth.js`: Implement `requireContentAccess` and update `requireVerified` copy for guest.
  - `backend/app.js`: Mount `requireContentAccess` on protected routes.

- [ ] Task 5: Backend Tests
  - Create `backend/tests/guestAccess.test.js` covering declaration, gating, admin review, and domain restrictions.

- [ ] Task 6: Frontend Roles, Context & Navigation
  - `frontend/src/lib/roles.ts`: Add `guest` to `CanonicalRole` and `RANK` (0).
  - `frontend/src/contexts/AuthContext.tsx`: Add `account_kind` to profile state.
  - `frontend/app/onboarding.tsx`: Redirect outsider accounts with role `user` to `/guest-declaration`.
  - `frontend/app/guest-declaration.tsx`: Create guest declaration form.
  - `frontend/app/pending-review.tsx`: Create holding screen with 30s polling.

- [ ] Task 7: Frontend UI Gating & Admin Review
  - `frontend/src/components/guest/GuestBanner.tsx`: Create read-only banner for guest profiles.
  - Hide write affordances for guest accounts across feeds/discussions/profiles.
  - `frontend/app/settings.tsx`: Add contact privacy scope control (`public`, `school`, `private`).
  - `frontend/app/(admin)/verification.tsx`: Add "Guests" tab for reviewing guest access requests.
  - Typecheck (`npx tsc --noEmit`) and verify.
