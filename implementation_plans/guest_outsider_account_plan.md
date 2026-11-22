# Plan: Guest / Outsider Account

Status: Approved design, pending implementation.
Scope: backend + frontend + one migration. Read-only guest accounts with admin review, separate from LCCB verification.

## 0. Decisions (locked)

- Reuse the existing `guest` role string (no new role).
- Domain check via existing `verificationPolicy.isSchoolAccount()` / `SCHOOL_EMAIL_DOMAIN` (`@lccbonline.edu.ph`).
- Separate queues: LCCB verification uses `profile_verification_requests`; guests use a new `guest_access_requests` table.
- Admin review is required before a guest sees any content. Pending guests can enter the app (authenticated session) but see a holding screen and are blocked server-side from all content.
- Reviewers: admin + superadmin only, campus-level (no department scoping).
- Decline reuses existing suspension machinery.
- A guest can later file a normal LCCB verification request (upgrade path is the existing queue).
- Guests never appear in people search, mentions, or friend suggestions (already true).

## 1. Data model — migration 062

Create `backend/migrations/062_guest_access_requests.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.guest_access_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  affiliation_type text NOT NULL CHECK (affiliation_type IN ('student_elsewhere','faculty_elsewhere','professional','researcher','other')),
  affiliation_name text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by text REFERENCES public.profiles(id),
  decision_note text,
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_guest_access_status_submitted
  ON public.guest_access_requests (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_access_user
  ON public.guest_access_requests (user_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guest_declared_at timestamptz,
  ADD COLUMN IF NOT EXISTS guest_purpose text,
  ADD COLUMN IF NOT EXISTS guest_affiliation_type text,
  ADD COLUMN IF NOT EXISTS guest_affiliation_name text,
  ADD COLUMN IF NOT EXISTS guest_location text;
```

`chk_profiles_role` already permits `guest` (053) — no change.

## 2. Backend — policy

### 2.1 `backend/utils/roles.js`
- Add `GUEST: "guest"` is already there. No change needed.
- Export a `DECLARATION_ROLES` constant: `["guest"]`. (New export.)

### 2.2 `backend/services/verificationPolicy.js`
- `SELECTABLE_ROLES` unchanged (student, faculty, departmentAdmin, admin).
- Add `DECLARATION_ROLES = ["guest"]` and export it.
- `ROLE_FIELDS[ROLES.GUEST] = null` (guests never use the OTP path).
- `needsRoleChoice`: treat `guest` as chosen — add `canonical !== ROLES.GUEST` to the null check (currently `canonical === null || canonical === ROLES.USER`).
- `isSelectable`: unchanged (guest not selectable from the LCCB picker).
- `REVIEWER_SCOPE`: add `guest` to admin and superadmin sets, `byDepartment: false`.
- `reviewableRolesFor`, `canReview`, `reviewersForRequest`: unchanged logic, but they now include guest where scope says so.
- `fieldsFor('guest')` returns null.
- Export `DECLARATION_ROLES`.

### 2.3 `backend/models/guestAccessModel.js` (new)
Functions:
- `createRequest(userId, { purpose, affiliationType, affiliationName, location })` → insert row, return id.
- `getPendingForUser(userId)` → latest pending request row (or null).
- `listRequests({ status, limit })` → for admin queue, ordered by submitted_at desc.
- `approve(id, decidedBy, note)` → set status='approved', decided_at, decided_by, decision_note; copy fields to profiles; set verification_status='approved'; return the row.
- `decline(id, decidedBy, note)` → set status='declined' + suspension fields; return row.

Use the existing db query pattern (parameterized, no string interpolation).

## 3. Backend — endpoints

### 3.1 `POST /auth/google` (`authController.googleAuth`)
After resolving email, add to the response payload:
```js
account_kind: isSchoolAccount(email) ? "school" : "outsider",
```
No other change — profile creation still happens with role='user'.

### 3.2 `POST /auth/signup` completion (verify-email / OTP verification)
Same: return `account_kind` in the success body.

### 3.3 `POST /auth/guest` (new)
Route: `router.post("/guest", auth.requireAuth, auth.loadProfile, auth.requireActiveAccount, guestDeclarationController.declare)`.
Controller (`guestDeclarationController.js`, new):
- Validate body: purpose (1..500), affiliation_type (enum), affiliation_name (1..200), location (0..200).
- If `isSchoolAccount(req.user.email)` → 400 `{ error: "School accounts verify instead", code: "school_account" }`.
- If `req.profile.role !== 'user'` (already declared) → 400 `{ error: "Account type already set", code: "role_already_set" }`.
- Create request row; update profile role='guest', verification_status='pending', guest_declared_at=now(), plus the four fields.
- Return `{ success: true, request_id, status: "pending" }`.

### 3.4 `GET /auth/account-kind` (new, optional)
Returns `{ account_kind }` for the current user. Used by frontend to route. Alternatively include in `GET /users/me`. Prefer including in `GET /users/me` response (`account_kind` field) to avoid an extra call.

### 3.5 `GET /verification/requests?kind=guest` (admin, superadmin)
Extend `verificationController.listRequests` to accept `kind=guest` and delegate to `guestAccessModel.listRequests`. Separate from the LCCB queue.

### 3.6 `POST /verification/requests/:id/approve` and `:id/decline` with `kind=guest`
Delegate to `guestAccessModel.approve/decline`. Apply `requireRole('admin','superadmin')`.

## 4. Backend — middleware & content gate

### 4.1 `middleware/auth.js`
- Add `requireContentAccess(req, res, next)`:
  - if `req.profile?.role === 'guest'` and `req.profile?.verification_status !== 'approved'` → 403 `{ error: "Guest access is pending approval", code: "guest_pending" }`.
  - else next().
- Export it.

### 4.2 `app.js`
Mount `requireContentAccess` after `loadProfile`+`requireActiveAccount` on:
- `/api/posts`
- `/api/search`
- `/api/users` (GET only — but middleware is mount-wide; writes are already requireVerified; the gate only blocks guests pending, which is fine for all methods on these routes)
- `/api/conversations` (already requireVerified, but pending guest should get a clear code, not "verify your identity")
- `/api/notifications`
- `/api/moderation` (guests shouldn't reach it anyway, but consistent)
- `/api/reports`, `/api/blocks` — optional, keep consistent.

Do NOT mount on `/api/auth`, `/api/verification`, `/api/files` (public files need to load for the pending screen's branding), `/api/public`, `/api/upload` (already requireVerified).

### 4.3 `getPublicProfile` (`models/userModel.js`)
- Add `contact_scope` to the SELECT.
- Add `contact_scope` to the returned object.
- When `viewerId` resolves to a guest profile (or no viewer), and `row.contact_scope !== 'public'`, set `contact_email`, `facebook_url`, `instagram_url`, `twitter_url` to null in the returned object.
- Add a helper `viewerIsGuest(viewerId)` that queries profiles role, or accept a `viewerRole` param. Simpler: pass `viewerId` and look up role inside; cache per request is unnecessary.

### 4.4 `requireVerified` copy
- If role === 'guest' → return 403 `{ error: "Guest accounts are read-only", code: "guest_read_only" }`.

## 5. Frontend — routing

### 5.1 `app/_layout.tsx`
- Guest role goes to `/(tabs)/` (already covered by the `else` branch since guest !== user/null/student-unverified). Verify `needsRoleChoice` semantics don't catch guest — handled in 2.2. No change needed here beyond confirming.

### 5.2 `app/onboarding.tsx`
- Add a branch: if `profile?.role === 'user'` and `account_kind === 'outsider'` → `router.replace('/guest-declaration')`. (Or: if `account_kind === 'outsider'` and no `guest_declared_at`.)

### 5.3 `app/guest-declaration.tsx` (new)
- Form: purpose (textarea), affiliation_type (picker: student_elsewhere / faculty_elsewhere / professional / researcher / other), affiliation_name (text), location (text). All required except location.
- Submit → `POST /auth/guest`. On success → `/pending-review`.

### 5.4 `app/pending-review.tsx` (new)
- Holding screen: "Your read-only access is being reviewed by an administrator."
- Shows submitted purpose/affiliation (read-only).
- Sign out button.
- Polls `GET /users/me` every 30s; when `verification_status === 'approved'` → `/(tabs)/`.

## 6. Frontend — UI

### 6.1 `src/contexts/AuthContext.tsx`
- Add `account_kind: "school" | "outsider" | null` to profile state (from `GET /users/me`).
- `isGuest` stays for the anonymous mode; rename consideration is out of scope (keep both, document).

### 6.2 `src/lib/roles.ts`
- Add `guest` to `CanonicalRole` and `RANK` (rank 0), `CANONICAL` map.

### 6.3 `src/components/profile/...` and tabs
- Guest banner component: "Guest account — read only." Show when `profile.role === 'guest'`.
- Hide write affordances (composer, like, comment, follow, message, save) when guest. Use a `useIsGuest()` hook or `profile.role === 'guest'`.

### 6.4 `app/settings.tsx`
- Add "Contact info visible to" control: Public / LCCB only / Private → `PATCH /users/me` with `contact_scope`.
- Add the privacy section if absent (check existing tabs).

### 6.5 Profile rendering
- Contact section: render only if `contact_scope === 'public'` OR viewer is a verified LCCB member (non-guest). For guests, show "Contact info hidden" placeholder.

### 6.6 Login screen
- The existing "Continue as guest" (anonymous) stays. Add a note: "Or sign in with Google/email to request guest access."

## 7. Admin review

### 7.1 `(admin)/verification.tsx`
- Add a "Guests" tab. Query `GET /verification/requests?kind=guest`.
- Render: username, purpose, affiliation type + name, location, submitted_at.
- Approve/decline buttons + decision note textarea.

### 7.2 `(admin)/guests.tsx` (optional, alternative)
- If the verification screen is too crowded, split into its own page. Decide during implementation; prefer the tab to keep one review surface.

## 8. Tests

### Backend (node --test)
- `tests/guestAccess.test.js` (new):
  - `POST /auth/guest` rejects school-account emails with `school_account`.
  - rejects when role already set (`role_already_set`).
  - creates request + sets profile role='guest', status='pending'.
  - `requireContentAccess` returns 403 `guest_pending` for pending guest on `/api/posts`, `/api/search`, `/api/users/:id`.
  - approved guest passes `requireContentAccess`.
  - `GET /verification/requests?kind=guest` returns only guest requests, only to admin/superadmin.
  - approve copies fields to profile and sets verification_status='approved'.
  - decline sets suspended.
- Extend `tests/fileRoutes.test.js`? No — unrelated.
- Update `verificationPolicy` tests if they assert `needsRoleChoice`/`SELECTABLE_ROLES` exact values.

### Frontend (vitest)
- `guestDeclaration.test.tsx`: form validation, submit calls `POST /auth/guest`, redirect to pending-review.
- `pendingReview.test.tsx`: polls, redirects on approval.
- `roles.test.ts`: `guest` canonicalizes and ranks 0.

## 9. Migration order / rollout

1. Run migration 062.
2. Deploy backend (new endpoints + middleware).
3. Deploy frontend.
4. Verify: register with a Gmail → declaration screen → pending-review → admin approves → content loads.

## 10. Open items (not blocking implementation)

- Tabs for an approved guest: feed + discussions (public only) vs capstones+search+profiles only. Default to full tab set filtered to public; revisit if product wants a stripped-down guest app.
- Whether a guest's own profile is publicly viewable — recommend yes, with contact info governed by `contact_scope` (default `private` for guests).

## 11. Files touched (estimate)

Backend (new): `migrations/062_guest_access_requests.sql`, `models/guestAccessModel.js`, `controllers/guestDeclarationController.js`, `controllers/guestReviewController.js` (or extend verificationController).

Backend (edited): `utils/roles.js`, `services/verificationPolicy.js`, `controllers/authController.js`, `controllers/verificationController.js`, `models/userModel.js`, `middleware/auth.js`, `app.js`.

Frontend (new): `app/guest-declaration.tsx`, `app/pending-review.tsx`, `src/components/guest/GuestBanner.tsx`.

Frontend (edited): `app/_layout.tsx`, `app/onboarding.tsx`, `app/settings.tsx`, `src/contexts/AuthContext.tsx`, `src/lib/roles.ts`, `src/lib/api.ts` (new calls), profile rendering, write-affordance gating.

Tests: `backend/tests/guestAccess.test.js`, `frontend` tests above.
