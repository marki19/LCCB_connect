# LCCB Connect — Security, Auth, Media, and Visibility Plan

**Date:** 2026-11-04
**Scope:** `backend/` (Express + raw SQL/Postgres), `frontend/` (Expo SDK 58 + supabase-js), Supabase project (Free plan)
**Supersedes:** the auth/identity sections of `Security_plan.md` (which is stale — see §12)
**Status:** Phases 0–5 implemented; Phase 6 (adaptive challenge) stretch

---

## 1. Constraints

| Constraint | Consequence |
|---|---|
| Supabase **Free** plan | No session timeouts, no leaked-password protection, no single-session, auth audit logs kept 1 hour |
| No ORM, no app→database link | All data access is `apiFetch` → Express → `db.query()`. Supabase JS is allowed only for `auth.*` |
| PDFs must go through the backend | App uploads to Express, Express uploads to Storage, Postgres stores only the key |
| Per-item visibility | `public` / `friends` / `custom` / `private`, custom = specific friends picked per item |
| Development phase | Storage capacity is not a concern yet |

## 2. Decisions locked

- Email domain is `@lccbonline.edu.ph` everywhere.
- Password minimum 8 characters.
- Test accounts get their password from `TEST_USER_PASSWORD` in `backend/.env`; no password is committed.
- TOTP MFA. Mandatory for every user (7-day re-auth), admins capped at 8 hours.
- Google OAuth is added after MFA, not before.
- Files inherit visibility from their parent row. No per-file visibility.

## 3. Phase 0 — Auth baseline (½ day)

1. Replace `@lccb.edu.ph` in **15 code occurrences across 4 files**:
   - `frontend/app/(auth)/register.tsx` — lines 43, 106, 389, 402
   - `frontend/app/(auth)/login.tsx` — lines 29, 58, 219, 232
   - `backend/scripts/seed-test-users.js` — 5 emails
   - `backend/tests/admin.test.js` — lines 206, 210
2. Replace 7 references in `SPEC-superadmin-console.md`.
3. `register.tsx:113` — minimum 6 → 8 characters.
4. Supabase Dashboard → Authentication → Providers → Email: minimum length 8; enable email confirmation **only if** the SMTP limit allows it (Free built-in SMTP is a few messages per hour — confirm before enabling).
5. Delete and re-seed the five test accounts with a strong `TEST_USER_PASSWORD` from `.env`.
6. Move session storage from `AsyncStorage` to `expo-secure-store` (`frontend/src/lib/supabase.ts`) — pentest finding #2, still open.
7. Fix the 403 body that echoes the whole role enum (`backend/middleware/auth.js:289-295`) — pentest finding #3.

**Acceptance:** sign-up rejects 7 characters; no `lccb.edu.ph` left in code; `npx tsc --noEmit` and `npm test` clean.

## 4. Phase 1 — Signup lockdown (1 day)

The curl bypass: anyone can call `/auth/v1/signup` with any address. The client-side check is not a control.

1. Try the **Before User Created** auth hook (Postgres function variant). The hooks doc lists it as Free/Pro; the pricing table says Free only gets Custom Access Token + Send Email. Confirm in Dashboard → Authentication → Hooks before writing code.
2. Fallback if the hook is unavailable: `BEFORE INSERT` trigger on `auth.users` that raises when `split_part(lower(NEW.email), '@', 2) <> 'lccbonline.edu.ph'`. The generic 500 GoTrue returns is acceptable.
3. Migration `013_domain_lockdown.sql`, applied with `backend/scripts/run-sql.js`.

**Ordering:** Phase 0 must land first, or the re-seed is blocked by the trigger.

**Acceptance:** a real `curl` to `/auth/v1/signup` with a Gmail address fails; an `@lccbonline.edu.ph` address succeeds.

## 5. Phase 2 — Content visibility (4 days) ✅ **DONE**

### Schema — migration `014_content_visibility.sql` ✅ Applied

```sql
CREATE TYPE content_visibility AS ENUM ('public', 'friends', 'custom', 'private');

ALTER TABLE posts  ADD COLUMN visibility content_visibility NOT NULL DEFAULT 'public';
ALTER TABLE theses ADD COLUMN visibility content_visibility NOT NULL DEFAULT 'public';

CREATE TABLE post_audience (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE thesis_audience (
  thesis_id UUID NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (thesis_id, user_id)
);

CREATE FUNCTION is_friend(a TEXT, b TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = a AND f.addressee_id = b)
        OR (f.addressee_id = a AND f.requester_id = b))
  );
$$ LANGUAGE sql STABLE;
```

Two audience tables, not one generic table: foreign keys then cascade properly, and there is no orphan-cleanup job.

### The rule lives in one place

`visible_posts(viewer TEXT)` and `visible_theses(viewer TEXT)` as table-valued functions. Every read uses `FROM visible_posts($1)`. **The four-way `OR` clause must never appear inline in a model file** — if it does, that is a bug.

### Read paths to convert

| File | Functions |
|---|---|
| `backend/models/postModel.js` | `getAllPosts`, `getPostById`, `getComments`, `getFlaggedPosts`, `getFlaggedComments` |
| `backend/models/thesisModel.js` | `getAllTheses`, `getThesisById`, `getFlaggedTheses` |
| `backend/controllers/publicController.js` | public feed, public peers — **public rows only** |
| `backend/controllers/adminController.js` | console lists — **bypass visibility** (moderators see everything) |
| `backend/controllers/moderationController.js` | queues — **bypass visibility** |
| `backend/models/notificationModel.js` | verify payloads do not embed private titles |

Moderation paths bypass on purpose. A moderator who cannot see a hidden or private row cannot moderate it.

Guests: `public` only. `hidden` overrides every visibility level.

### API and UI

- `visibility` accepted on post/thesis create and update; strict Zod enum.
- `visibility: 'custom'` requires a non-empty `audience: string[]` of friend ids; server rejects non-friends.
- Composer: four-option picker + friend multi-select for custom. Both `frontend/app/create.tsx` and `frontend/app/upload-thesis.tsx`.
- Detail views show why access was denied only as a 404 (no existence oracle).

**Acceptance:** one test per visibility level per resource, plus guest, plus friend, plus non-friend, plus owner. A friends-only post is invisible in the feed, the detail view, search, and comments. ✅ **Verified via backend tests**

## 6. Phase 3 — Media through the backend (1–2 days) ✅ **DONE**

### Upload ✅ Implemented

- Add `multer` to `backend/`.
- `POST /api/theses` and `PUT /api/theses/:id` accept `multipart/form-data`. Backend:
  1. verifies magic bytes `%PDF-` (not the declared MIME),
  2. enforces size cap,
  3. uploads with the **service role** to `theses/{uploaderId}/{uuid}.pdf`,
  4. writes the key it generated. The client never sends `pdf_url` again.
- Remove `supabase.storage` calls from `frontend/src/lib/upload.ts`. The app only calls `apiFetch`.
- Thesis delete removes the storage object (open item in `implementation_plans/post-audit-fixes.md`).

### Read ✅ Implemented

`backend/middleware/storageUrls.js` wraps `res.json` and expands keys to public URLs — **this is the single choke point, not eleven call sites.** Replace the public expansion for `pdf_url` with:

- `GET /api/theses/:id/file` → runs `visible_theses($viewer)` → 404 on miss → returns `{ url }` signed for **5 minutes**. ✅
- `GET /api/posts/:id/file` → runs `visible_posts($viewer)` → 404 on miss → returns `{ url }` signed for **5 minutes**. ✅
- List/detail responses stop returning a public `pdf_url`. Return `has_file: true` instead. ✅
- Frontend: `frontend/app/(tabs)/search.tsx:78` currently `Linking.openURL(item.pdf_url)` — change to fetch the signed URL first, then open. ✅

Short expiry matters: a signed URL issued before a visibility flip stays valid until it expires.

### Buckets — migration `015_storage_private_buckets.sql` ✅ Applied (partial)

- `theses`: private. Drop the public-read policy from `011_storage_buckets.sql`. ✅
- `assets` currently holds **both** avatars and post images, and is public. A friends-only post's image is therefore still readable by URL. Two options:
  - **Recommended:** split into `avatars` (public) + `assets` (private, signed). +1 day. ✅ **Done** — `avatars` bucket created, `assets` private
  - Accept the leak and document it.

**Acceptance:** an unauthenticated `GET` of a thesis object URL returns 403; the signed URL works once and expires. ✅ **Verified** — Post images also use signed URLs via `/api/posts/:id/file`

## 7. Phase 4 — MFA, sessions, audit (5–6 days) ✅ **DONE**

### MFA ✅ Implemented
- TOTP enrollment (`/api/auth/mfa/enroll`) → returns secret, URI, QR code URL
- TOTP verification (`/api/auth/mfa/enroll/verify`) → activates factor
- TOTP unenrollment (`/api/auth/mfa/unenroll`) → requires current TOTP code
- Factor listing (`/api/auth/mfa/list`) → lists factors (no secrets)
- `mfa_factors` table with `user_id`, `type` (totp), `secret`, `status` (verified/unverified)
- QR code generation via external service (production: consider local `qrcode` npm package)

### Session age limits ✅ Implemented
- All roles: max 7 days
- Admin/superadmin: max 8 hours
- In-memory cache (60s TTL) to avoid per-request DB lookup
- Middleware: `checkSessionAge` runs after `requireAuth` + `loadProfile`

### AAL2 enforcement ✅ Implemented
- `requireAal2` middleware checks JWT `aal` claim
- Admin/superadmin roles require `aal2` (MFA verified)
- Non-admins: `aal1` acceptable

### Audit logging ✅ Implemented
- `session_events` table records: login, logout, force_signout, mfa_challenge
- `admin_audit_log` extended with: `auth.login_success`, `auth.logout`, `mfa.enroll`, `mfa.unenroll`, `mfa.challenge`
- Logs include IP, user agent, outcome metadata

### Migration ✅ Applied
- `019_mfa.sql` — `mfa_factors` and `session_events` tables with RLS

## 8. Phase 5 — Google OAuth (1–2 days) ⏳ **PENDING** (requires dev build)

### MFA

- Enrollment screen in `frontend/app/settings.tsx`: `auth.mfa.enroll` → QR → `challenge` → `verify`.
- Unenroll screen. No backup codes exist in Supabase TOTP — **recovery is admin-assisted** via the Admin API. This is a support requirement, not a nicety.
- Enforcement in `backend/middleware/auth.js`: decode the `aal` claim from the already-verified token; admins require `aal2`.
- Google OAuth sign-in is `aal1`. Admins still enroll TOTP.

### Sessions (Free plan has no session timeouts)

- Read `session_id` from the verified token; check `auth.sessions.created_at`.
- Any role: reject past **7 days**.
- Admin roles: reject past **8 hours**.
- Cache the session lookup in memory for 60 seconds to avoid a DB round trip per request.
- Sign-out on app cold start for admin roles, so "log in every time" is literal.

### Audit

- `admin_audit_log` already exists and is append-only (migration 010). It has no IP/user-agent columns — put `ip`, `user_agent`, `outcome` in `metadata` JSONB, or add columns in `016_audit_auth_events.sql`.
- Log: successful login, logout, MFA enroll/unenroll, MFA failure, role change, suspension, deletion, post/thesis create/update/delete, visibility change.
- **Failed logins cannot be audited on Free.** No password-verification hook (Teams+), and failures never reach the database. Supabase's own log holds them for one hour. Document as a known limitation.
- Login capture: `AFTER INSERT` trigger on `auth.sessions` writing to `admin_audit_log`. Fallback if the `auth` schema rejects triggers: log the first authenticated request per `session_id` in middleware.
- Never log: passwords, tokens, MFA secrets, request bodies.

## 8. Phase 5 — Google OAuth (1–2 days) ✅ **DONE**

- Google Cloud project; Android + iOS client IDs (SHA-1 for both debug and release), web client ID.
- `@react-native-google-signin/google-signin` → `signInWithIdToken({ provider: 'google' })`.
- Requires a **development build**; Expo Go cannot run the native module.
- The Phase 1 domain trigger applies to OAuth signups too — the hook/trigger sees the email.
- If the school runs Google Workspace on `lccbonline.edu.ph`, restrict the OAuth consent screen to that domain as a second layer.
- Backend: `POST /api/auth/google` exchanges Google ID token for session via `signInWithIdToken`, enforces `@lccbonline.edu.ph` domain, creates profile if missing, records audit event.
- Frontend: `signInWithGoogle(idToken)` in `src/lib/auth.ts`, "Continue with Google" button in `app/(auth)/login.tsx` (dynamic import to avoid breaking Expo Go).
- Environment: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in frontend `.env.example`.

## 9. Phase 6 — Adaptive device/network challenge (stretch, 3–5 days) ⏳ **STRETCH**

- `auth_devices(user_id, device_id, label, platform, first_ip, last_ip, first_seen_at, last_seen_at)`.
- Device id generated once, stored in `expo-secure-store`, sent with each login.
- Unknown device or unseen network → require `aal2` before entering the app.
- **The device id is client-supplied and spoofable.** This is a UX prompt, not a security boundary. The real boundary is admin `aal2`, always.

## 10. Cross-cutting

- Tests: `node --test` + `supertest`, currently 216 passing. Add one per visibility level, one per session cap, one for the signup domain.
- `npx tsc --noEmit` and `expo lint` must stay clean (28 pre-existing warnings).
- CI already runs tests, typecheck, audit, gitleaks.

## 11. Open decisions

| # | Decision | Default if unanswered |
|---|---|---|
| D1 | Split the `assets` bucket so post images are private? | Yes — otherwise friends-only images leak |
| D2 | 8-hour admin cap acceptable? | Yes |
| D3 | Adaptive device/network challenge in scope? | No — stretch only |
| D4 | Email confirmation enabled on Free SMTP? | No — rate limits stall testing |

## 12. Risks and corrections

1. **`Security_plan.md` is stale.** It says `GET /api/users` has no role gate; `userController.js:13` now returns 403. Update or supersede it.
2. **The `before-user-created` hook plan availability is contradictory** between Supabase's docs and pricing page. Verify in the dashboard before building; the trigger fallback is fine.
3. **Missing the visibility clause on one read path leaks private rows.** Table-valued functions are the mitigation.
4. **Signed URLs outlive a visibility flip** until expiry. Keep expiry at 5 minutes.
5. **Free plan pauses projects after a week of inactivity** — irrelevant today, but a demo-day risk.
6. **Realtime bypasses the backend** (`frontend/src/lib/realtime.ts` subscribes to Postgres WAL directly). On the strict reading of the professor's rule this is a violation. Options: accept, or replace message realtime with polling. Not in scope unless requested.
7. `app.set('trust proxy', N)` is still unset (pentest finding #6). Only matters behind a reverse proxy.

## 13. Sequencing

| Order | Phase | Days | Status |
|---|---|---|---|
| 1 | 0 — Auth baseline | 0.5 | ⚠️ Partial (reverse signup replaced Supabase flow) |
| 2 | 1 — Signup lockdown | 1 | ✅ Done (via reverse signup) |
| 3 | 2 — Visibility | 4 | ✅ Done |
| 4 | 3 — Media through backend (depends on 2) | 1–2 | ✅ Done |
| 5 | 4 — MFA, sessions, audit | 5–6 | ✅ Done |
| 6 | 5 — Google OAuth | 1–2 | ✅ Done |
| 7 | 6 — Adaptive challenge | 3–5, optional | ⏳ Stretch |

**Total for 0–5: ~2 weeks (Phases 0–5 complete, Phase 6 remaining).**
