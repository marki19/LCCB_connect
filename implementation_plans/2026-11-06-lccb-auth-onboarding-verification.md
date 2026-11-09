# LCCB Connect — Signup, OTP, Onboarding, and Admin Verification Plan

**Date:** 2026-11-06
**Scope:** `backend/` (Express 5 + raw SQL), `frontend/` (Expo SDK 58 + supabase-js), Supabase project (Free plan)
**Supersedes:** §3 Phase 0, §4 Phase 1, and §7 Phase 4 (MFA) of `2026-11-04-lccb-security-auth-media-visibility.md`. That file's visibility (Phase 2) and media (Phase 3) sections remain valid.
**Does not touch:** `implementation_plans/superadmin-console-todo.md` (superadmin console plan) and `implementation_plans/superadmin-console-plan.md`. Those stay as they are.

---

## 1. What the user gets

1. A student opens the app, taps **Create account**, enters their `@lccbonline.edu.ph` email, a password for this app, and the same password twice.
2. A 6-digit code arrives by email. They type it in the app. No links, no `localhost:8081` in an email.
3. The app asks for full name, student ID, department, course, and year level.
4. A department admin (or any admin/superadmin) sees the request, checks the name and student ID, then **Approves** or **Declines with a message**.
5. Approved: the identity fields are written to the profile and locked. The student can post, message, and upload.
6. Declined: the student reads the note, fixes the fields, resubmits.
7. Forgot password sends a 6-digit code, then a new-password screen.
8. Sign in works with **email or student ID**.

While unverified the student can browse everything and edit their bio and avatar. Every write is blocked server-side with `403 { code: "not_verified" }`.

---

## 2. Decisions locked

| # | Decision | Why |
|---|---|---|
| D1 | Supabase **"Allow new users to sign up" stays ON** | Self-service signup, no pre-created accounts |
| D2 | Password is an **app password**, never the school account password | No SSO integration exists; asking for school credentials adds liability and buys nothing |
| D3 | Email confirmation stays ON, template uses `{{ .Token }}` | Confirmation is the only proof the address is real. Without it anyone can register `president@lccbonline.edu.ph` and get a session |
| D4 | 6-digit code, **no email links** | Links break on mobile and leak `localhost` in the demo |
| D5 | Full name is **typed by the user**. No derivation from the email | `markgabriel.antipo@` proves derivation is wrong ("Markgabriel Antipo") |
| D6 | Student ID is a **second login identifier**, resolved by a backend proxy | Supabase only signs in by email. A public ID→email lookup leaks addresses |
| D7 | Student ID format: 4–20 chars of `[A-Za-z0-9-]`, stored uppercased | No roster exists to validate against. The admin review *is* the check |
| D8 | Student ID only resolves for `verification_status = 'verified'` | An unverified or declined ID must not be a login handle |
| D9 | Statuses: `pending`, `approved`, `declined`. One pending request per user | Resubmission after decline creates a new row, so history is kept |
| D10 | **One approval.** `departmentAdmin` (own department), `admin`, `superadmin` (all) | Two sequential approvals add waiting, not safety |
| D11 | After approval, **name / student ID / department / course are locked**. Bio, avatar, and year level stay editable | Year level changes every year; locking it creates support work for no security gain |
| D12 | The write gate applies only to `role = 'student'` | Staff accounts are provisioned by an admin and must not be trapped in onboarding |
| D13 | The review queue is **one screen, mobile and desktop** | The existing moderation console is desktop-only; a phone must be able to approve |
| D14 | Password reset ends with a **sign-out → login** | Avoids a half-state where a recovery session lands inside onboarding |
| D15 | **MFA is deferred** — see §3 | Not required for this feature; roughly 1.5 extra days |
| D16 | Sender is **Brevo free SMTP**, already configured and proven | Delivered a real email to a real school address; 300/day |

---

## 3. Explicitly out of scope

**MFA — deferred, not built in this plan.**

- Recommended shape when it ships: TOTP for `departmentAdmin`, `admin`, `superadmin` only. Students are not forced.
- Why not now: it adds enrollment/challenge/recovery screens plus an admin-assisted reset path. It does not affect this feature's correctness.
- Why privileged-only later: a stolen student account can post; a stolen admin account can suspend users, change roles, and read the audit log.
- Ship trigger: the first time a privileged account is used outside a demo, or the first real admin onboarded.
- Nothing in this plan blocks it. `requireVerified` and a future `requireMfa` are independent middleware.

Also out of scope: Google OAuth, school-roster validation of student IDs, admin-created accounts, two-step approvals, and any paid service.

---

## 4. Data model — `backend/migrations/016_identity_verification.sql`

```sql
-- One-shot backfill: only run the "verify everyone existing" step if the column
-- did not exist yet, so re-running this file cannot silently auto-verify new
-- students who are genuinely pending.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
      AND column_name='verification_status'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN email TEXT,
      ADD COLUMN student_id TEXT,
      ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (verification_status IN ('unverified','pending','verified')),
      ADD COLUMN verified_at TIMESTAMPTZ;

    -- Every profile that exists today predates this feature: seeded test
    -- accounts, faculty, and admins must not be locked out.
    UPDATE public.profiles
       SET verification_status = 'verified',
           verified_at = NOW();
  END IF;
END $$;

-- Non-unique: uniqueness of the address itself lives in auth.users.
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));

-- One verified owner per student ID, case-insensitive. NULLs are unlimited.
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_student_id
  ON public.profiles (upper(student_id))
  WHERE student_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.profile_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','declined')),
  -- Snapshot of what the student submitted. Never read from profiles at review
  -- time, so an edit cannot change what the reviewer is looking at.
  full_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  course_id UUID NOT NULL REFERENCES public.courses(id),
  year_level TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_verification_one_pending
  ON public.profile_verification_requests (user_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_verification_status
  ON public.profile_verification_requests (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_department
  ON public.profile_verification_requests (department_id, status);

ALTER TABLE public.profile_verification_requests ENABLE ROW LEVEL SECURITY;

-- Same deny-by-default rule as every other table: only the Express API
-- (table owner) may read or write it.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON public.profile_verification_requests FROM %I', r);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS set_verification_updated_at
  ON public.profile_verification_requests;
CREATE TRIGGER set_verification_updated_at
  BEFORE UPDATE ON public.profile_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

Also append the same DDL to `backend/schema.sql` so a fresh install matches, and add `profile_verification_requests` to the `REVOKE` list at `schema.sql:364`.

**Email exposure rule (applies to every new query):** `profiles.email` and `profiles.student_id` may appear only in (a) the caller's own profile response, (b) admin-console responses, (c) verification-request responses to reviewers. They must never appear in `/api/public/*`, peers, posts, comments, theses, or notifications. No existing public query uses `profiles.*`, so adding the columns leaks nothing today — keep it that way.

---

## 5. Phases

Each phase leaves the app runnable. Verification command for the backend is `cd backend; npm test`. Frontend is `cd frontend; npx tsc --noEmit`.

### Phase 0 — Workspace prep (30 min, no repo changes)

| Step | Action |
|---|---|
| 0.1 | Delete `C:\Users\mark\.config\opencode\plugins\claude-mem.js` (and any other `*claude-mem*` file in that folder). `opencode.json` lists only `superpowers`, so no config edit is needed. |
| 0.2 | Stop the claude-mem worker listening on port `37777` (`Get-NetTCPConnection -LocalPort 37777`, then stop that PID). Leave `C:\Users\mark\.claude-mem` on disk unless deletion is requested. |
| 0.3 | Supabase → Authentication → Emails → **Confirm signup** template: subject `Your LCCB Connect code`, body `Your code is {{ .Token }}`. Delete the link. |
| 0.4 | Supabase → **Reset password** template: subject `Reset your LCCB Connect password`, body `Your code is {{ .Token }}`. Delete the link. |
| 0.5 | Supabase → Authentication → Providers → Email: confirm signup ON, minimum password length 8, **Email OTP length = 6**. |
| 0.6 | Confirm Brevo SMTP is still saved (host `smtp-relay.brevo.com`, port 587, sender verified). Trigger one reset email to a real address and check inbox + spam. |

**Acceptance:** the reset email body contains a 6-digit number and no URL.

### Phase 1 — Backend foundation (½ day)

**Files:** `migrations/016_identity_verification.sql`, `schema.sql`, `models/userModel.js`, `middleware/auth.js`, `validation/index.js`, `services/auditService.js`.

1. Apply migration 016 with `node scripts/run-sql.js migrations/016_identity_verification.sql`.
2. `userModel.createUser` gains `email` in the insert; `getUserById`/`getAllUsers` keep `p.*` (self/admin only — safe).
3. `userModel.updateUser` gains no new fields. A new `userModel.getLoginEmailByStudentId(studentId)` runs:
   `SELECT id, email FROM public.profiles WHERE upper(student_id) = $1 AND verification_status = 'verified' AND email IS NOT NULL`.
4. `middleware/auth.js` gains `requireVerified`:
   ```js
   function requireVerified(req, res, next) {
     const role = normalizeRole(getRole(req));
     if (role !== "student") return next();          // D12
     if (req.profile?.verification_status === "verified") return next();
     return res.status(403).json({
       error: "Verify your identity to do that",
       code: "not_verified",
     });
   }
   ```
   Export it next to `requireActiveAccount`.
5. `validation/index.js` gains:
   - `studentIdSchema` = `z.string().trim().min(4).max(20).regex(/^[A-Za-z0-9-]+$/)` + `.transform(v => v.toUpperCase())`
   - `verificationSubmitSchema` = `{ full_name: 2..200, student_id: studentIdSchema, department_id: uuid, course_id: uuid, year_level: 1..50 }` `.strict()`
   - `verificationDecisionSchema` = `{ note: z.string().trim().min(3).max(300) }` `.strict()` (used by decline only)
   - `loginIdentifierSchema` = `{ identifier: 3..254, password: 8..200 }` `.strict()`
   - `student_id` is **not** added to `createProfileSchema` or `updateProfileSchema` — it must only be writable through the verification flow.
6. `auditService.ACTIONS` gains `VERIFICATION_SUBMIT`, `VERIFICATION_APPROVE`, `VERIFICATION_DECLINE` (`verification.submit`, `verification.approve`, `verification.decline`).

**Acceptance:** migration applies twice with no error and no second blanket backfill; `npm test` still green.

### Phase 2 — Signup, OTP, and password reset (1 day)

**Backend:** none.

**Frontend files:** `app/(auth)/register.tsx` (rewrite), `app/(auth)/verify-email.tsx` (new), `app/(auth)/forgot-password.tsx` (new), `app/(auth)/reset-password.tsx` (new), `app/(auth)/login.tsx` (link only).

1. `register.tsx`: fields are **email, password, confirm password**. Delete the name field and the `apiFetch("/users")` call at lines 101–114 (it always 401s — there is no session before confirmation). Validate: domain ends with `@lccbonline.edu.ph`, password ≥ 8, both passwords equal. On success:
   ```ts
   const { error } = await supabase.auth.signUp({ email, password });
   if (error) return setGeneralError(error.message);
   router.push({ pathname: "/(auth)/verify-email", params: { email, flow: "signup" } });
   ```
   Never reveal whether the address already existed — Supabase returns a stub user for that case.
2. `verify-email.tsx`: one input, `keyboardType="number-pad"`, `maxLength={6}`, letter-spaced digits.
   - Submit → `supabase.auth.verifyOtp({ email, token, type: "signup" })`.
   - Success → `router.replace("/onboarding")`.
   - Failure → inline `That code is wrong or expired.` and a **Resend code** action calling `supabase.auth.resend({ type: "signup", email })`, disabled for 60 s with a visible countdown.
   - Secondary action: `Use a different email` → `/(auth)/login`.
3. `forgot-password.tsx`: email field → `supabase.auth.resetPasswordForEmail(email)` → always navigate to `/(auth)/reset-password?email=…` with the line `If that address exists, a code is on its way.` Never branch on the response.
4. `reset-password.tsx`: fields are code, new password, confirm. Submit → `verifyOtp({ email, token, type: "recovery" })` → `updateUser({ password })` → `signOut()` → `router.replace("/(auth)/login")` with a one-line success message passed as a param.
5. `login.tsx`: wire the dead **Forgot Password?** (line 297) to `/(auth)/forgot-password`. Keep theme toggle, guest button, and the "Create one" footer.

**Acceptance:** a real new address receives a 6-digit code, the app confirms it, and lands on `/onboarding`; a bad code shows the inline error and a working resend; reset with a real code changes the password and returns to login.

### Phase 3 — Sign in with email or student ID (½ day)

**Backend files:** `controllers/authController.js` (new), `routes/authRouter.js` (new), `middleware/loginLimits.js` (new), `app.js`.

1. `POST /api/auth/login` body `{ identifier, password }`.
   - `identifier` contains `@` → email is the identifier itself.
   - otherwise normalize (trim, uppercase) → `userModel.getLoginEmailByStudentId`.
   - no match → `401 { error: "Invalid email, student ID, or password" }` (same body as a wrong password).
   - match → `supabase.auth.signInWithPassword({ email, password })` using the existing anon client in `middleware/auth.js`.
   - success → `200 { access_token, refresh_token, expires_at }`.
   - `Email not confirmed` → `403 { error: "Confirm your email first", code: "email_not_confirmed" }`.
2. `middleware/loginLimits.js`: `loginIpLimiter` (10 per 15 min per IP) and `loginIdentifierLimiter` (5 per 15 min, key = normalized identifier). Apply both to the login route.
3. Mount **before** the authenticated routers in `app.js`:
   ```js
   app.use("/api/auth", authRouter);
   ```
   It must never receive `requireAuth`.
4. SQL errors are logged server-side only; the response stays generic.

**Frontend files:** `src/lib/auth.ts` (new), `app/(auth)/login.tsx`.

5. `src/lib/auth.ts` → `signInWithIdentifier(identifier, password)`:
   - contains `@` → `supabase.auth.signInWithPassword`
   - else → `apiJson("/auth/login", { method: "POST", ... })` → `supabase.auth.setSession({ access_token, refresh_token })`
6. `login.tsx`: label becomes **Email or Student ID**, placeholder `student@lccbonline.edu.ph or 2023-00123`, validation branches on the presence of `@`. The rest of the screen is unchanged.

**Acceptance:** both identifiers reach the feed; a wrong ID and a wrong password produce the identical message; 6 rapid failures return 429.

### Phase 4 — Onboarding and the verification request (1 day)

**Backend files:** `models/verificationModel.js` (new), `controllers/verificationController.js` (new), `routes/verificationRouter.js` (new), `app.js`.

1. `verificationModel.js`:
   - `getLatestForUser(userId)`
   - `createPending(userId, snapshot)` — insert; `23505` on the partial unique index becomes `409 { error: "You already have a request under review" }`
   - `updatePending(userId, snapshot)` — `UPDATE ... WHERE user_id=$1 AND status='pending'`
   - `listQueue({ departmentId, status, limit, cursor })` — joins `profiles` for `email` and `departments`/`courses` for names
   - `approve(id, reviewer, client)` and `decline(id, reviewer, note, client)` operating inside `db.withTransaction`
2. `verificationController.js`:
   - `submit` (`POST /`): validate catalog refs with the existing `validateCatalogReferences` helper from `userController`; reject if the profile is already `verified` (`409`); insert pending; set `profiles.verification_status='pending'`; audit `verification.submit`; notify the department's admins (`notificationService.getTargetAdmins(department_id)` + `createNotifications` with type `verification_submitted`, `targetId` = request id).
   - `updateMine` (`PUT /mine`): same validation; `404` when there is no pending request; audit `verification.submit` with `metadata.resubmission = true`.
   - `getMine` (`GET /mine`): latest request plus `can_resubmit` = (`status = 'declined'` or none).
   - `queue` (`GET /queue?status=pending|approved|declined`): `departmentAdmin` is forced to their own `department_id`; missing department → `403 { error: "Your account has no department assigned" }`. `admin`/`superadmin` see everything.
   - `approve` (`POST /:id/approve`) and `decline` (`POST /:id/decline`, body `{ note }`).
     Approval, in one transaction:
     1. `SELECT ... FOR UPDATE` the request; `409` if not pending.
     2. Scope check against the reviewer (same rule as the queue).
     3. Re-validate that department and course are still active and that the course belongs to the department. If not → `409 { error: "That department or course is no longer available. Ask the student to resubmit." }`
     4. `UPDATE profiles SET full_name, student_id, department_id, course_id, course = <course.name>, year_level, verification_status='verified', verified_at=NOW()`.
     5. `UPDATE` the request to `approved` with `reviewed_by`, `reviewed_at`.
     6. Audit `verification.approve`.
     7. `notificationService.notifyUser({ userId, type: "verification_approved", message: "Your account is verified." }, client)`.
     Declined: same scope and lock checks, `review_note` stored, profile stays `unverified`, request `declined`, audit + `verification_declined` notification carrying the note.
   - Unique student-ID conflict (`23505` on `uq_profiles_student_id`) → `409 { error: "That student ID is already verified to another account" }`, transaction rolled back.
3. `verificationRouter.js`:
   ```js
   router.get("/mine", controller.getMine);
   router.post("/", validate(verificationSubmitSchema), controller.submit);
   router.put("/mine", validate(verificationSubmitSchema), controller.updateMine);
   router.get("/queue", requireRole("departmentAdmin","admin","superadmin"), controller.queue);
   router.post("/:id/approve", requireRole(...), controller.approve);
   router.post("/:id/decline", requireRole(...), validate(verificationDecisionSchema), controller.decline);
   ```
   Mounted in `app.js` at `/api/verification` behind `requireAuth`, `loadProfile`, `requireActiveAccount`. **Not** behind `requireVerified` — an unverified user is exactly who calls it.

**Frontend files:** `app/onboarding.tsx` (new, replaces `complete-profile.tsx`), `app/_layout.tsx`, `src/contexts/AuthContext.tsx`, `src/contexts/AuthContext.tsx` types.

4. `AuthContext.Profile` gains `email?`, `student_id?`, `verification_status?`, `verified_at?`.
5. `AuthContext.fetchProfile` auto-provision sends `{}` only. Remove the `full_name`/`username` derivation at lines 104–108 — the server sets the id, role, and email from the token.
6. `app/onboarding.tsx`, one screen, three visible states read from `GET /api/verification/mine`:
   - **No request** → form: full name, student ID, department picker (`fetchDepartments`), course picker (`fetchCourses`), year level. Submit → `POST /api/verification`.
   - **Pending** → the submitted values, `Under review`, and **Edit submission** → `PUT /api/verification/mine`.
   - **Declined** → the reviewer's note in a warning block, the form prefilled with the declined values, button reads **Resubmit**.
   - Every state has a `Later` action → `router.replace("/(tabs)/")`.
   - Pickers reuse `src/components/SelectField.tsx`; catalog comes from `src/lib/catalog.ts`.
7. `app/_layout.tsx`: remove the `complete-profile` screen entry, add `<Stack.Screen name="onboarding" />` and `<Stack.Screen name="verify-requests" />`. Delete `frontend/app/complete-profile.tsx`.
8. `verify-email.tsx` routes to `/onboarding` after success (already in Phase 2). No route-guard redirect — an unverified student is allowed to browse (D12 + requirement).

**Acceptance:** a fresh confirmed account submits a request, sees `Under review`, the row appears in the reviewer queue, and a declined request shows the note with a prefilled form.

### Phase 5 — Reviewer queue (½ day)

**Frontend files:** `app/verify-requests.tsx` (new), `app/(moderation)/_layout.tsx`, `app/(tabs)/profile.tsx`, `app/(tabs)/notifications.tsx`.

1. `verify-requests.tsx` — one screen, works on phone and desktop:
   - Guard: `role` in `departmentAdmin | admin | superadmin`, else `router.replace("/(tabs)/")`.
   - Segmented filter `Pending / Approved / Declined`, default `Pending`.
   - Each row: full name, student ID, department · course · year level, submitted time, and (for `departmentAdmin`) nothing outside their department because the API already scopes it.
   - Row actions: **Approve** (confirm dialog naming the student), **Decline** (dialog with a required ≤300-char message).
   - After either action, the row leaves the list and the header count decreases.
   - `departmentAdmin` with no department sees the server's 403 message verbatim.
2. `(moderation)/_layout.tsx`: add a second `NavItem`, `Verification requests`, pushing `/verify-requests`. Desktop entry only, since the console is desktop-only.
3. `(tabs)/profile.tsx`: below the role line, a verification row:
   - `verified` → `Verified` chip with `verified_at`.
   - `pending` → `Under review` chip, tapping opens `/onboarding`.
   - `unverified` (or declined) → `Not verified — verify to post` row, tapping opens `/onboarding`.
   - Reviewers additionally see `Review requests` opening `/verify-requests`.
4. `(tabs)/notifications.tsx`: when `type` starts with `verification`, push `/verify-requests` for reviewers, `/onboarding` otherwise (next to the existing `new_message`/`friend_request` branches at lines 133–141).

**Acceptance:** a `departmentAdmin` on a phone approves a student from their department and sees nothing from other departments; a student receives `verification_approved` and gets full access after `refreshProfile()`.

### Phase 6 — Write gating (½ day)

**Backend files:** `routes/postRouter.js`, `routes/thesisRouter.js`, `routes/conversationRouter.js`, `routes/friendRouter.js`.

Apply `requireVerified` to these routes (import from `middleware/auth.js`), leaving reads, reports, and profile edits open:

| Router | Gated routes |
|---|---|
| `postRouter.js` | `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/like`, `POST /:id/comments`, `PUT /:id/comments/:commentId`, `DELETE /:id/comments/:commentId` |
| `thesisRouter.js` | `POST /`, `PUT /:id`, `DELETE /:id` |
| `conversationRouter.js` | `POST /`, `POST /:id/accept`, `POST /:id/messages`, `POST /:id/read`, `POST /:id/mute` |
| `friendRouter.js` | `POST /requests`, `POST /requests/:id/accept`, `POST /requests/:id/decline`, `DELETE /:userId` |

Not gated, on purpose: `GET` anything, `POST /api/messages/:id/report` (a safety valve must stay usable), avatar upload and profile edit (bio/avatar stay editable), and the verification endpoints themselves.

**Frontend files:** `src/lib/verification.ts` (new), `src/components/VerificationBanner.tsx` (new), `app/(tabs)/index.tsx`, `app/create.tsx`, `app/upload-thesis.tsx`, `app/messages/index.tsx`, `app/friends.tsx`.

1. `verification.ts`:
   ```ts
   export type VerifiableProfile = { role?: string | null; verification_status?: string | null };
   export const needsVerification = (p?: VerifiableProfile | null) =>
     (p?.role || "").toLowerCase() === "student" && p?.verification_status !== "verified";
   ```
2. `VerificationBanner.tsx`: one line `Verify your identity to post, message, and upload.` plus a `Verify` action opening `/onboarding`. Renders only when `needsVerification(profile)`.
3. Feed (`(tabs)/index.tsx`): banner above the list; tapping the composer FAB routes to `/onboarding` instead of `/create` while unverified.
4. `create.tsx` and `upload-thesis.tsx`: if unverified, render only the banner and a `Back` action — no form.
5. `messages/index.tsx` and `friends.tsx`: banner at the top; disable the "new message"/"add friend" entry points while unverified.
6. `apiJson` failures with status 403 still surface the server message; the banner is the primary explanation, so no global toast is added.

**Acceptance:** an unverified account gets `403 not_verified` from every gated route (verified by curl), sees the banner, and cannot reach a composer. After approval, `refreshProfile()` clears the banner on the next render.

### Phase 7 — Identity lock and department assignment (½ day)

**Backend files:** `controllers/userController.js`, `validation/index.js` (already strict).

1. `updateUser`:
   - `full_name` is rejected for non-admins with `400 { error: "Your name is set through identity verification" }`. Admins and superadmins may change it (audited through the existing admin path).
   - **Delete the claim-once branch at lines 144–168.** Any `department_id`/`course_id` from a non-admin is rejected with `400 { error: "Department and course changes go through identity verification" }`. This closes the hole where a student self-assigns a department and skips review.
   - Admin catalog changes keep `validateCatalogReferences`, and additionally clear `verified_at`? No — an admin assignment is authoritative; keep `verification_status` as is.
2. `createUser` keeps stripping `department_id`/`course_id`/`course` and now also sets `email: req.user.email` and leaves `verification_status` at its default.

**Frontend files:** `app/edit-profile.tsx`, `app/(admin)/users/[id].tsx`.

3. `edit-profile.tsx`: remove the editable full-name field. Render it as read-only text with the label `From your ID` — no helper sentence. Keep bio and year level editable. Department/course already render read-only at line 140. If `needsVerification(profile)`, show one `Verify` row opening `/onboarding`.
4. `(admin)/users/[id].tsx`: the Identity block at lines 455–462 is read-only. Add `Assign department` and `Assign course` selects (admin/superadmin only), saving through `PUT /api/users/:id`. This is the "admin screen for putting department" from the request.
5. Confirm `(admin)/departments.tsx` already creates/edits departments and courses; no change unless a gap shows up during implementation.

**Acceptance:** a verified student cannot change name, department, or course from the app; an admin can change both, and the change survives a `refreshProfile()`.

### Phase 8 — Tests, docs, and cleanup (½ day)

**Backend tests (`node --test "tests/**/*.test.js"`):**

| File | Cases |
|---|---|
| `tests/verification.test.js` (new) | submit creates pending + notification; second submit → 409; `PUT /mine` with no pending → 404; `departmentAdmin` cannot see another department's request; `admin` sees all; approve writes profile fields + sets `verified` + clears the gate; approve on a deactivated course → 409; duplicate student ID → 409 and profile untouched; decline without a note → 400; decline stores the note and leaves the profile unverified; a 9-char student ID is accepted, `AB` is rejected |
| `tests/verificationGate.test.js` (new) | unverified student → 403 `not_verified` on post create, comment, thesis create, conversation create, message send, friend request; verified student passes; unverified `faculty` passes (D12); report and profile edit always pass |
| `tests/login.test.js` (new) | email identifier delegates to `signInWithPassword`; verified student ID resolves to the email; unverified or unknown ID → generic 401; wrong password → same 401 body; confirmed-email check surfaces `email_not_confirmed` |
| `tests/validation.test.js` (extend) | `student_id` rejected in the profile PUT; unknown keys rejected; decline note bounds |

**Docs:**
- Append a "Signup → OTP → verification" section to `LCCB-Connect.md` describing the flow in one screen's worth of steps.
- Update `Security_plan.md` §auth to point at this plan (it still describes pre-created accounts).
- Add `student_id` and `verification_status` to `DATABASE.md`.

**Cleanup:**
- Delete `frontend/app/complete-profile.tsx` and its stack entry.
- Remove the dead name field and `/users` POST from `register.tsx`.
- Confirm no `lccb.edu.ph` (old domain) remains.
- `cd frontend; npx tsc --noEmit` clean; `npx expo lint` no new warnings.
- `cd backend; npm test` green (baseline was 256 passing).

**Acceptance:** all three commands clean; the demo runbook below completes end to end.

---

## 6. Task checklist

### Phase 0 — Workspace prep
- [x] 0.1 Delete the claude-mem plugin file
- [x] 0.2 Stop the claude-mem worker on port 37777
- [x] 0.3 Rewrite the confirm-signup template to `{{ .Token }}`
- [x] 0.4 Rewrite the reset-password template to `{{ .Token }}`
- [x] 0.5 Email provider settings: OTP length 6, confirm ON, password ≥ 8
- [x] 0.6 Re-test Brevo delivery to a real inbox

### Phase 1 — Backend foundation
- [x] 1.1 Migration 016 + `schema.sql` sync + REVOKE list
- [x] 1.2 `userModel`: `email` on create, `getLoginEmailByStudentId`
- [x] 1.3 `requireVerified` middleware
- [x] 1.4 Verification + login Zod schemas
- [x] 1.5 Audit action names

### Phase 2 — Signup, OTP, reset
- [x] 2.1 `register.tsx` = email + password + confirm
- [x] 2.2 `verify-email.tsx` with resend cooldown
- [x] 2.3 `forgot-password.tsx`
- [x] 2.4 `reset-password.tsx`
- [x] 2.5 Wire the dead Forgot Password link

### Phase 3 — Student-ID login
- [x] 3.1 `POST /api/auth/login` + controller
- [x] 3.2 Login rate limiters
- [x] 3.3 Mount `/api/auth` before authenticated routers
- [x] 3.4 `src/lib/auth.ts` + login screen label/validation

### Phase 4 — Onboarding + submit
- [x] 4.1 `verificationModel` CRUD + queue
- [x] 4.2 `verificationController` approve/decline transactions
- [x] 4.3 `verificationRouter` + mount
- [x] 4.4 `AuthContext` type + auto-provision cleanup
- [x] 4.5 `app/onboarding.tsx` three states
- [x] 4.6 Stack registration; delete `complete-profile.tsx`

### Phase 5 — Reviewer queue
- [x] 5.1 `app/verify-requests.tsx`
- [x] 5.2 Moderation sidebar entry
- [x] 5.3 Profile verification chip + reviewer entry
- [x] 5.4 Notification routing

### Phase 6 — Write gating
- [x] 6.1 Gate post/thesis/conversation/friend writes
- [x] 6.2 `verification.ts` + `VerificationBanner`
- [x] 6.3 Gate the feed composer, create, upload, messages, friends

### Phase 7 — Identity lock + department assignment
- [x] 7.1 Reject non-admin `full_name` / `department_id` / `course_id`
- [x] 7.2 `createUser` sets `email` from the token
- [x] 7.3 `edit-profile.tsx` read-only name
- [x] 7.4 Admin user detail: assign department + course

### Phase 8 — Tests, docs, cleanup
- [x] 8.1 `verification.test.js`
- [x] 8.2 `verificationGate.test.js`
- [x] 8.3 `login.test.js`
- [x] 8.4 `validation.test.js` additions
- [x] 8.5 Docs updated
- [x] 8.6 Typecheck, lint, full backend suite green

---

## 7. Order and checkpoints

| Order | Phase | Est. |
|---|---|---|
| 1 | 0 — Workspace prep | 30 min |
| 2 | 1 — Backend foundation | ½ day |
| 3 | 2 — Signup, OTP, reset | 1 day |
| 4 | 3 — Student-ID login | ½ day |
| 5 | 4 — Onboarding + submit | 1 day |
| 6 | 5 — Reviewer queue | ½ day |
| 7 | 6 — Write gating | ½ day |
| 8 | 7 — Identity lock | ½ day |
| 9 | 8 — Tests, docs, cleanup | ½ day |

**Total: ~4 working days.** Phases 1–4 alone deliver signup → code → submit (~2.5 days).

**Checkpoint after Phase 2:** a brand-new address can sign up, confirm with a code, and reach the app. Nothing is gated yet.
**Checkpoint after Phase 4:** a request reaches the database with a snapshot; the queue endpoint returns it via curl.
**Checkpoint after Phase 6:** the whole loop works, and only unverified users are limited.
**Checkpoint after Phase 8:** suite, typecheck, and lint clean; runbook passes.

---

## 8. Demo runbook (manual verification)

1. `cd backend; npm start`, `cd frontend; npx expo start`.
2. On a phone: Create account → real `@lccbonline.edu.ph` address → password twice.
3. Open the inbox, copy the 6 digits, enter them. Land on onboarding.
4. Enter a real-looking name and student ID, pick department/course/year, submit. Screen shows `Under review`.
5. Browse the feed — works. Tap the composer — banner appears, no form.
6. Sign in on desktop as `deptadmin@lccbonline.edu.ph` (`12345678`), open **Verification requests**, decline with a message.
7. Back on the phone: profile shows the note; edit and resubmit.
8. Approve on desktop. Phone refreshes: `Verified`, composer works, posting succeeds.
9. Sign out. Sign in with the **student ID** and the same password. It works.
10. Sign out. Forgot password → code → new password → signed out → sign in with the new password.
11. Negative checks: wrong code → inline error; 6 fast wrong logins → 429; a Gmail address at signup → blocked by the domain trigger.

---

## 9. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Recovery/confirm OTP not delivered (Brevo spam) | Demo fails at step 3 | Test with the real recipient before the demo; check Brevo → Transactional → Logs (`delivered` vs `blocked`); confirm the sender is verified |
| Brevo free cap (300/day) during rehearsal | Emails stop | Cooldown on resend, one address per test, 30/hour Supabase cap |
| `{{ .Token }}` left in only one template | One flow sends a broken link | Phase 0.3 and 0.4 are separate checklist items; the acceptance test opens both emails |
| Existing test accounts locked out by the new gate | Cannot demo admin screens | Migration backfill + D12 (students only) |
| Student claims someone else's student ID | Wrong identity approved | Unique index + admin review of name/ID; a conflict returns 409 |
| Student self-assigns a department through `PUT /users/:id` | Skips review | Phase 7.1 removes the claim-once branch |
| Server added `email` to `profiles` leaking via list endpoints | Privacy leak | §4 exposure rule; no public query uses `p.*`; add to review checklist |
| Approval races two admins | Double write | `SELECT ... FOR UPDATE` + `status='pending'` check inside the transaction |
| Re-running migration 016 in a later session | Blanket-verifies pending students | `DO` block guards the backfill on column existence |
| `departmentAdmin` without a department | Sees an empty queue and cannot act | Explicit 403 message; admin assigns a department in the console |

---

## 10. Open items

None. Every decision the earlier conversation left open is fixed in §2:

- Name — typed by the user (D5), not derived.
- Account creation — self-service (D1).
- Email delivery — Brevo free (D16).
- OTP — 6-digit codes in both flows (D4).
- Student ID format — tolerant pattern, admin check (D7).
- Approval — one step (D10).
- Decline — message required, resubmit allowed (D9, D11).
- MFA — explicitly deferred with a ship trigger (§3).
