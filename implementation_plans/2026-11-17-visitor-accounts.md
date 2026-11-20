# Implementation Plan: Visitor (Guest) Accounts (Workstream A)

Implements Workstream A from `C:\Users\mark\.opencode\plan\2026-11-17-master-plan.md`.
Enables outside visitors to create accounts with email OTP verification, view public posts and theses, and contact authors through opt-in contact info, with strict read-only access.

## Proposed Changes

### Phase A1: Database Constraint & Role Definitions
- Migration `053_guest_role.sql`:
  - Recreate `chk_profiles_role` constraint to include `'guest'`.
  - Add `contact_scope TEXT NOT NULL DEFAULT 'organization' CHECK (contact_scope IN ('public', 'organization', 'private'))` to `profiles`.
- Update `backend/utils/roles.js`:
  - Add `GUEST: "guest"` to `ROLES`, and `'guest'` to `ALL_ROLES`.
  - Update `init-schema.sql` to include `'guest'` in `profiles.role` check constraint.

### Phase A2: Visitor Signup Endpoints
- `backend/validation/index.js`:
  - Add `requestVisitorSignupSchema`: email is `z.string().trim().toLowerCase().email()`, plus password and full_name.
  - Add `verifyVisitorSignupSchema` and `resendVisitorSignupSchema`.
- `backend/controllers/authController.js`:
  - Add `requestVisitorSignup`: parameterize `requestSignup` to permit non-LCCB emails.
  - Add `verifyVisitorSignup`: verify OTP, create auth user, create profile with `role = 'guest'`, `verification_status = 'unverified'`, and derived username.
  - Add `resendVisitorSignup`.
- `backend/routes/authRouter.js`:
  - Mount `POST /api/auth/request-visitor-signup`.
  - Mount `POST /api/auth/verify-visitor-signup`.
  - Mount `POST /api/auth/resend-visitor-signup`.

### Phase A3: Read-Only Guard & Protected Mounts
- `backend/middleware/auth.js`:
  - Export `blockGuestWrites(req, res, next)`: returns 403 `guest_write_forbidden` on `POST/PUT/PATCH/DELETE` when `role === 'guest'`.
- `backend/app.js`:
  - Add `mountProtected(path, router)` helper including `auth.requireAuth`, `auth.loadProfile`, `auth.requireActiveAccount`, `auth.blockGuestWrites`.
  - Use `mountProtected` for authenticated API routers.

### Phase A4: Thesis PDF Gating (D1 Alignment)
- D1 Decision: Hide full PDF download for visitors / unauthenticated users; title preview is available; authenticated campus members have access.
- `backend/controllers/publicController.js` and `backend/controllers/thesisController.js`:
  - If user is guest or unauthenticated, omit `pdf_url` from response.
- `frontend/src/app/capstones.tsx`, `frontend/src/app/search.tsx`, `frontend/src/components/profile/ProfileThesesList.tsx`:
  - When `pdf_url` is missing or user is guest, display preview badge and "Contact author for full paper" button.

### Phase A5: Contact Details Privacy Scope (D2 Alignment)
- D2 Decision: User can toggle contact sharing between `public` (all users including guests) and `organization` (LCCB users only).
- `backend/models/userModel.js`:
  - `getPublicProfile`: expose contact fields (`contact_email`, `facebook_url`, `instagram_url`, `twitter_url`) only if `contact_scope === 'public'` OR (viewer is authenticated campus member and `contact_scope === 'organization'`).
  - `updateUser`: support `contact_scope`.
- `backend/validation/index.js`:
  - Accept `contact_scope: z.enum(['public', 'organization', 'private']).optional()` in `updateProfileSchema`.
- Frontend edit profile / contact info:
  - Add audience selector for contact details (Public vs Organization).

### Phase A6: Frontend Routing & Onboarding
- `frontend/src/app/onboarding.tsx`:
  - If `user?.role === 'guest'`, bypass academic student verification completely and route directly to main app.
- `frontend/src/app/register.tsx`:
  - Add visitor tab / toggle: "LCCB Campus Sign Up" vs "Visitor Sign Up".

### Phase A7: Verification & Testing
- Unit and integration tests in `backend/tests/guest-accounts.test.js`:
  - Guest signup with non-LCCB domain succeeds and sets `role = 'guest'`.
  - Guest token gets 403 on all mutating routes (`POST /api/posts`, `POST /api/messages`, `POST /api/upload/posts`, etc.).
  - Guest token gets 200 on read routes (`GET /api/posts`, `GET /api/theses`).
  - Thesis PDF is hidden for guests.
  - Contact details hidden if `contact_scope === 'organization'` and viewer is guest.
