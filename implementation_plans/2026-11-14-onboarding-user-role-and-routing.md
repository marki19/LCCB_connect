# Implementation Plan: Onboarding User Role & Request Routing

## Goal
Make new accounts start with `role = 'user'`, require role self-selection during onboarding from `[student, faculty, departmentAdmin, admin]`, enforce review routing (students/faculty to department admins with fallback escalation to campus admins when unstaffed; department admins to admins/superadmins; admins to superadmins only), and prevent self-promotion or demotion on approval.

## Phases

### Commit 1: Phases A to E (Backend Schema, Vocabulary, Auth Defaults, Request Verification & Approval)
- **Phase A — Schema (`047_user_role.sql`)**:
  - `ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';`
  - Recreate `chk_profiles_role` to include `'user'`.
  - Recreate `chk_verification_role_shape` on `profile_verification_requests` to reject `'superadmin'`.
  - Add `escalated_at TIMESTAMPTZ` to `profile_verification_requests`.
  - Apply migration to live DB; update `backend/schema.sql`, `backend/init-schema.sql`, and bump `_migrations` baseline to 047.
- **Phase B — Vocabulary & Constants**:
  - `backend/utils/roles.js`: add `'user'` to `ALL_ROLES`.
  - `backend/middleware/auth.js`: add `user: 0` to `ROLE_RANK`.
  - `backend/validation/index.js`: add `'user'` to `updateProfileSchema.role` and `CanonicalRole`.
  - `frontend/src/lib/roles.ts`: add `'user'` to `CanonicalRole` and `RANK` at 0.
  - Fallbacks in `authController.js` and `nativeAuth.js`: change `'student'` fallback to `'user'`.
- **Phase C — Signup Defaults**:
  - `verifySignup`: insert `role: "user"`.
  - `googleAuth`: insert `role: "user"`.
- **Phase D — Verification Request & Snapshot**:
  - `backend/services/verificationPolicy.js`: add `SELECTABLE_ROLES = ['student', 'faculty', 'departmentAdmin', 'admin']`.
  - `snapshotFor(role, body)`: validate requested role against `SELECTABLE_ROLES`.
  - `POST /api/verification`: require `role` in body; 409 if profile already verified.
  - `PUT /api/verification/mine`: preserve stored `role`, reject role mutation during `pending`.
  - `GET /api/verification/mine`: return `role`, `fields` for that role, and `selectable_roles` when profile role is `'user'`.
  - `validation/index.js`: update `verificationSubmitSchema` to require `role: z.enum(SELECTABLE_ROLES)`.
- **Phase E — Approval Role Writing**:
  - `backend/models/verificationModel.js`: update `approve()` SQL query:
    `role = CASE WHEN role IS NULL OR role = 'user' THEN $7 ELSE role END`
    where `$7` is `request.role`.

### Commit 2: Phase F (Routing & Escalation)
- `backend/controllers/verificationController.js`:
  - When `notifyReviewers` finds zero department reviewers for student/faculty, set `escalated_at = NOW()` on the request and notify admins + superadmins.
  - In `getQueue`: include escalated requests in the campus admin/superadmin queue.
  - In `canReview`: allow campus admins/superadmins to review student/faculty requests ONLY if `escalated_at IS NOT NULL`.

### Commit 3: Phase G (Client Gates & Onboarding UI)
- `frontend/app/_layout.tsx`: gate unverified users to `/onboarding`.
- `frontend/src/components/IdentityBanner.tsx`: show for `'user'` as well as `'student'`.
- `frontend/app/create.tsx` & `frontend/app/post/[id].tsx`: update student-only checks to include `'user'` or rely on `profile_completed`.
- `frontend/app/onboarding.tsx`: add role selection step driving the form schema.
- `frontend/src/components/verification/VerificationForm.tsx`: support selectable role and include `role` in submit payload.
- `frontend/app/(admin)/verification.tsx`: fallback to `'user'` instead of `'student'`.
- `frontend/app/(admin)/users/index.tsx`: add `'User'` role label and filter.

### Phase H: Verification & Tests
- Backend test suite: unit tests for `role = 'user'`, rejection of `superadmin` in verification, approval role preservation, escalation routing.
- Frontend test suite and type check (`tsc --noEmit`, `vitest`).
