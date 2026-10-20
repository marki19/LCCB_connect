# Spec: Superadmin Console

**Status:** Implemented and verified on 2026-10-20. `tasks/todo.md` records the completed build and QA checks.
**Date:** 2026-10-20
**Scope owner:** LCCB Connect
**Supersedes:** the S1/S2/S3 sequence in `Feature_plan.md` for admin work.

---

## 1. Problem

The current admin area is a thin desktop panel:

- Login lands admins on `(admin)`, but the overview is three placeholder cards.
- There is no audit trail. A role change, suspension, or deletion cannot be traced.
- There is no suspension model. Deleting a user leaves the Supabase Auth account behind.
- Moderation is split across cards and tabs with no real content explorer and no reason notes.
- There is no way to make a campus-wide announcement.
- `GET /api/users` is readable by every authenticated user, including the full directory.
- Loading `(tabs)` directly after login leaves an admin on the student feed.
- The panel has no way back to the app, and the app has no way back to the panel.

The result is a panel that looks administrative but cannot govern anything.

## 2. Objective

Turn the desktop admin area into a real governance console that:

1. Opens automatically after login for `admin` and `superadmin`.
2. Gives superadmins the controls that are genuinely system-wide.
3. Gives admins the shared moderation and user-management tools they need.
4. Records every privileged mutation in an append-only audit log.
5. Lets either role return to the normal app as the same identity, without a second login.

Mobile keeps the normal student/faculty experience. The panel is desktop-only.

## 3. Users

| Role | How they use the console |
|---|---|
| `superadmin` | Full console: users, roles, suspensions, force sign-out, deletion, content deletion, audit log, announcements, catalog, settings. |
| `admin` | Shared console: users, lower-role changes, suspensions, hide/restore content, announcements, catalog, settings. No audit log, no hard deletes, no force sign-out. |
| `departmentAdmin` | Not admitted to this console in v1. Existing department-scoped moderation endpoints remain for a future console. |
| `faculty`, `student` | Never admitted. Direct navigation to `(admin)` redirects to the app. |

## 4. Decisions already locked

- Panel-first on desktop: an `admin`/`superadmin` login lands on `/(admin)`, not the feed.
- "Back to App" opens `(tabs)` in the same session.
- The app's desktop header shows an **Admin Console** link for `admin`/`superadmin`, so the trip is reversible. It is a return path, not the primary landing.
- v1 surfaces: Overview, Users, Reports & Content, Announcements, Audit, plus the existing Departments & Courses and Settings.
- Strict split: `superadmin` only for audit, hard deletes, force sign-out, and granting `admin`.
- No new share/repost schema.
- Ownership failures return 404, never 403.
- Announcements are in-app only. No email or push delivery in v1.
- Deferred: impersonation, dedicated analytics page, departmentAdmin console, mobile admin UI, report assignment/handoffs.
- Testing uses the cleaned Supabase database and the five `@lccb.edu.ph` accounts with password `123456`.

## 5. Assumptions

1. Tenant scale is one campus. User counts fit in a few thousand; no sharding or background job queue is needed.
2. The backend connects to Postgres as the database owner. RLS is defense in depth for direct Supabase clients, not the authorization path for Express.
3. `SUPABASE_SERVICE_ROLE_KEY` stays server-side only. It is already present in `backend/.env`.
4. Supabase access tokens are short-lived (about one hour). "Force sign-out" revokes refresh sessions immediately; an already-issued access token may remain valid until expiry unless the account is also suspended.
5. Post and comment reports are represented by `moderation_status = 'flagged'`. Only private messages have a separate `message_reports` table.
6. Theses have `moderation_status` but no admin moderation endpoint today. This spec adds one.
7. A thesis has no dedicated detail route in the app. "Open in app" for a thesis goes to the Repository tab; posts and comments deep-link to `/post/:id`.
8. The panel is a web surface built with React Native Web. No native admin screens.

## 6. Capability map

This is one console, delivered in ordered workstreams. Each workstream has its own acceptance gate.

| ID | Responsibility | Depends on |
|---|---|---|
| `foundation` | Migration 010, audit service, suspension state, active-account middleware, shared role normalization, service-role client | none |
| `admin-api` | Overview, user list/dossier, role/suspend/force-sign-out/delete, content explorer, audit read, announcement send/history | `foundation` |
| `panel-shell` | Sidebar/header rebuild, role guard, panel-first behavior, Back to App, app return link | `foundation` |
| `overview` | KPI cards, needs-attention queue, recent actions | `admin-api`, `panel-shell` |
| `user-governance` | Users table, dossier route, all user actions, audit screen | `admin-api`, `overview` |
| `moderation` | Reports queue, content library, hide/restore/delete, thesis moderation, reason notes | `admin-api`, `overview` |
| `announcements` | Composer, audience targeting, recipient count, history, notification fan-out | `admin-api`, `overview` |
| `release` | Legacy route hardening, test suite, manual role QA, docs | all |

**Build order:** `foundation` → `panel-shell` → `admin-api` → `overview` → `user-governance` → `moderation` → `announcements` → `release`.

`admin-api` can start in parallel with `panel-shell` after `foundation`; nothing else starts before `overview` is usable.

## 7. Out of scope

- Impersonating another user.
- A separate analytics page or charting library.
- A departmentAdmin console.
- Any mobile admin UI.
- Report assignment, ownership, handoff, or SLA timers.
- Email, SMS, or push delivery for announcements.
- Editing or deleting an announcement after send.
- Editing or deleting audit rows.
- User creation or invitation from the console.
- Profile self-delete UI.
- PDF storage cleanup when a thesis is deleted.
- Comment threading.
- Admin users pagination by page number (cursor only).
- Reworking the student feed's visual design.

---

## 8. Architecture

### 8.1 Stack

Unchanged: Expo SDK 57 / React Native 0.86 / React 19 / Expo Router 57 / NativeWind, Express 5 / Node / `pg`, Supabase Postgres + Auth, `node:test` + `supertest`.

### 8.2 New and changed files

**Backend**

| Path | Purpose |
|---|---|
| `backend/migrations/010_superadmin_console.sql` | Audit table, suspension columns, indexes, RLS/revokes, append-only trigger |
| `backend/schema.sql` | Keep the fresh-install snapshot in sync with 010 |
| `backend/services/supabaseAdmin.js` | Lazy service-role client; never imported by frontend code |
| `backend/services/auditService.js` | Single write path for audit rows |
| `backend/services/accountService.js` | Supabase Auth ban/unban, session revocation, auth-user deletion |
| `backend/models/adminModel.js` | Overview counts, user list/dossier, content explorer, audit queries, announcement recipient queries |
| `backend/controllers/adminController.js` | Admin API handlers |
| `backend/routes/adminRouter.js` | `/api/admin/*` routes, mounted before the catalog router |
| `backend/controllers/moderationController.js` | Add reason validation, audit writes, superadmin delete gate, thesis moderation |
| `backend/models/thesisModel.js` | Add admin moderation and admin delete queries |
| `backend/controllers/userController.js` | Gate the directory, restrict legacy role changes/deletes |
| `backend/middleware/auth.js` | Add `requireActiveAccount`, make `loadProfile` idempotent |
| `backend/validation/*` | Role change, suspension, reason, announcement schemas |

**Frontend**

| Path | Purpose |
|---|---|
| `frontend/app/(admin)/_layout.tsx` | Rebuilt console shell, nav groups, Back to App, role guard |
| `frontend/app/(admin)/index.tsx` | Overview |
| `frontend/app/(admin)/users/index.tsx` | Users table |
| `frontend/app/(admin)/users/[id].tsx` | User dossier |
| `frontend/app/(admin)/content.tsx` | Reports & Content (Queue + Library tabs) |
| `frontend/app/(admin)/announcements.tsx` | Composer + history |
| `frontend/app/(admin)/audit.tsx` | Superadmin audit log |
| `frontend/app/suspended.tsx` | Suspended-account screen |
| `frontend/src/lib/roles.ts` | Canonical role normalization and rank |
| `frontend/src/lib/adminApi.ts` | Typed admin API client and response types |
| `frontend/src/components/admin/*` | `DataTable`, `StatusBadge`, `ReasonDialog`, `ConfirmDeleteDialog`, `KpiCard`, `EmptyState` |
| `frontend/src/contexts/AuthContext.tsx` | Handle `account_suspended` |
| `frontend/app/_layout.tsx` | Suspended route and panel guard integration |
| `frontend/app/(tabs)/_layout.tsx` | Desktop Admin Console return link |

### 8.3 Route mounting

The existing catalog router already owns `/api/admin` behind `requireAuth → loadProfile → requireRole("admin","superadmin")`. Mount the new router before it:

```js
app.use("/api/admin", auth.requireAuth, auth.requireActiveAccount,
  auth.requireRole("admin", "superadmin"), adminRouter);
app.use("/api/admin", auth.requireAuth, auth.requireActiveAccount,
  auth.requireRole("admin", "superadmin"), adminCatalogRouter);
```

Unknown paths fall through to the catalog router. Per-route gates add `requireSuperAdmin` where the matrix requires it.

`requireActiveAccount` must be added to every authenticated mount, not only `/api/admin`; otherwise a suspended user keeps using posts, messages, and uploads. It loads the profile, treats an expired `suspended_until` as active, and otherwise returns:

```json
{
  "error": "Account suspended",
  "code": "account_suspended",
  "suspended_until": "2026-11-01T00:00:00.000Z",
  "reason": "Repeated harassment"
}
```

`loadProfile` becomes idempotent (`if (req.profile !== undefined) return next()`) so the extra middleware does not double-query.

### 8.4 Service-role boundary

`supabaseAdmin.js` reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, creates the client once, and exports `getSupabaseAdmin()`. If the key is missing:

- log a boot warning once;
- make auth-dependent actions return `503 { error: "Admin auth service unavailable" }`;
- never fall back to the anon key.

The service-role key never appears in an API response, log line, client bundle, or test fixture.

---

## 9. Data model

### 9.1 Migration 010: audit table

```sql
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  actor_username TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_label TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Notes:

- `actor_id` and `target_id` are text and intentionally have **no foreign keys**. Audit rows must outlive deleted accounts and content.
- `actor_username`/`actor_role` are snapshots so history stays readable.
- `target_label` is a human-readable snapshot (username, post title, thesis title, announcement title).
- `reason` is the operator's note; required by the API for every mutation.
- `metadata` stores structured before/after values. It must never contain secrets.
- Indexes: `(created_at DESC, id DESC)`, `(actor_id, created_at DESC)`, `(action, created_at DESC)`, `(target_type, target_id, created_at DESC)`.
- `ENABLE ROW LEVEL SECURITY`; `REVOKE ALL ... FROM anon, authenticated`. Express uses the owner connection.
- Append-only trigger:

```sql
CREATE OR REPLACE FUNCTION public.reject_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$$;

CREATE TRIGGER admin_audit_log_append_only
BEFORE UPDATE OR DELETE ON public.admin_audit_log
FOR EACH ROW EXECUTE FUNCTION public.reject_audit_mutation();
```

`TRUNCATE` remains an owner/maintenance operation; no API exposes it.

### 9.2 Migration 010: suspension state

Add to `public.profiles`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_by TEXT;
```

Rules:

- A profile is **currently suspended** when `suspended_at IS NOT NULL` and (`suspended_until IS NULL` or `suspended_until > NOW()`).
- An expired sanction is shown as `active` and does not block requests. The fields remain until an admin unsuspends, preserving history in the audit log.
- Add `CHECK (suspended_until IS NULL OR suspended_at IS NOT NULL)`.
- Add a partial index on `(suspended_at) WHERE suspended_at IS NOT NULL`.
- `suspended_by` is a text id, no FK; the audit row is the durable record.
- Supabase Auth `ban_duration` is set in parallel: the exact remaining duration for a timed suspension, `876000h` (100 years) for indefinite. Unsuspend sets `ban_duration: 'none'`.

### 9.3 Audit action vocabulary

Canonical strings; the API is the only writer.

| Action | Target type | Metadata |
|---|---|---|
| `user.role_change` | `user` | `{ from, to }` |
| `user.suspend` | `user` | `{ until, indefinite }` |
| `user.unsuspend` | `user` | `{ previous_until, previous_reason }` |
| `user.force_signout` | `user` | `{ sessions_revoked }` |
| `user.delete` | `user` | `{ username, full_name, role }` |
| `content.hide` | `post` \| `comment` \| `thesis` | `{ previous_status, title_or_excerpt }` |
| `content.restore` | `post` \| `comment` \| `thesis` | `{ previous_status }` |
| `content.delete` | `post` \| `comment` \| `thesis` | `{ title_or_excerpt, author_id }` |
| `report.review` | `message_report` | `{ message_id, sender_id, reporter_id }` |
| `report.dismiss` | `message_report` | `{ message_id, sender_id }` |
| `announcement.send` | `announcement` | `{ title, body, audience, recipients }` |
| `catalog.create` | `department` \| `course` | `{ name }` |
| `catalog.update` | `department` \| `course` | `{ changes }` |
| `catalog.activate` / `catalog.deactivate` | `department` \| `course` | `{ name }` |

No check constraint on `action`; adding a new action should not require a migration. `auditService.record()` owns the allowed strings.

### 9.4 Transaction and failure behavior

- Every successful mutation writes exactly one audit row.
- If the audit insert fails, the endpoint returns 500. The client may retry; the server logs the failure. No audit row is silently skipped.
- Destructive user actions order the work so a failure leaves a retryable state: suspend/delete auth side first where possible, then the profile row, then the audit row. If Auth succeeds but the profile write fails, return 500 and surface a retry; do not report success.
- Treat an auth user that is already gone as a successful delete. A retry after a partial delete must be able to finish the profile cleanup without failing on "user not found" from Auth.
- Actions are idempotent where practical. Suspending an already-suspended account returns 200 with the current state and does not duplicate the audit row. Changing a role to its current value is a 200 no-op with no audit row.

---

## 10. Permissions

### 10.1 Matrix

| Action | `admin` | `superadmin` |
|---|---|---|
| Open the console, overview, users list/dossier | Yes | Yes |
| Grant `student`, `faculty`, `departmentAdmin` | Yes, target below caller | Yes, target below caller |
| Grant `admin` | **No** | Yes, target below caller |
| Grant `superadmin` | **No** | Yes, target below caller |
| Suspend / unsuspend | Yes, target below caller | Yes, target below caller |
| Force sign-out | **No** | Yes, target below caller |
| Delete a user | **No** | Yes, target below caller |
| View the full audit log | **No** | Yes |
| Hide / restore content | Yes | Yes |
| Delete content | **No** | Yes |
| Resolve / dismiss message reports | Yes | Yes |
| Send announcements | Yes | Yes |
| Manage departments and courses | Yes | Yes |
| Manage own role / suspend / delete self | **No** | **No** |

### 10.2 Server rules

Implemented in this order, always against the stored target row, never a client-supplied role:

1. Caller must be `admin` or `superadmin`.
2. Target must exist, or the response is 404.
3. Self-management is forbidden (`req.user.id === target.id` → 403 for role/suspend/force-sign-out/delete).
4. `canManage(req, target.role)` must be true: caller rank strictly greater than target rank.
5. For role grants: `admin` may only assign `student`, `faculty`, `departmentAdmin`; only `superadmin` may assign `admin` or `superadmin`.
6. For deletion: only `superadmin`; the target must still be strictly below.
7. For content deletion: only `superadmin`.

`ROLE_RANK` remains `student 0, faculty 1, departmentAdmin 2, admin 3, superadmin 4`. Role strings are normalized on the server. The frontend mirrors this only to disable controls; it never authorizes.

### 10.3 Error contract

| Status | Meaning |
|---|---|
| 400 | Invalid input, missing reason, bad date, bad role |
| 401 | Missing or invalid token |
| 403 | Wrong role, equal/higher rank, self-management, suspended account |
| 404 | Unknown user/content/report/announcement |
| 409 | Conflicting state where idempotency is not safe (none planned in v1) |
| 502/503 | Supabase Auth admin operation unavailable or failed |
| 500 | Unexpected failure, including audit-write failure |

Suspension responses add `code: "account_suspended"`. Other 403s keep `{ "error": "..." }`.

---

## 11. API

All endpoints are JSON, authenticated, and mounted under `/api/admin`. List endpoints use `{ items, total, next_cursor }`; `total` is the count after filters, `next_cursor` is an opaque string or null. Default limit 25, max 100.

### 11.1 Overview

`GET /api/admin/overview`

```json
{
  "users": {
    "total": 5, "students": 1, "faculty": 1, "department_admins": 1,
    "admins": 1, "superadmins": 1, "suspended": 0,
    "active_7d": 4, "new_7d": 0
  },
  "content": { "posts": 0, "theses": 0, "comments": 0, "hidden": 0, "flagged": 0 },
  "reports": { "message_reports": 0, "flagged_posts": 0, "flagged_comments": 0, "flagged_theses": 0 },
  "announcements": { "sent_30d": 0, "recipients_30d": 0 },
  "needs_attention": [
    { "kind": "message_report", "id": "...", "label": "...", "author": "...", "created_at": "..." }
  ],
  "recent_actions": [],
  "generated_at": "..."
}
```

`recent_actions` is populated for `superadmin` only; it is `[]` for `admin`. `needs_attention` contains at most 10 open items, oldest first.

### 11.2 Users

`GET /api/admin/users?q=&role=&department_id=&status=active|suspended&limit=&cursor=`

- `q` matches `username` or `full_name` with `ILIKE`.
- `status` is computed from the suspension rule, not a stored enum.
- Returns `id`, `username`, `full_name`, `avatar_url`, `role`, `department_id`, `department_name`, `course_id`, `course_name`, `year_level`, `created_at`, `last_seen_at`, `suspended_at`, `suspended_until`, `status`.
- Email is not in the list response.

`GET /api/admin/users/:id`

Returns the same profile fields plus:

```json
{
  "email": "student@lccb.edu.ph",
  "bio": "...",
  "skills": [],
  "suspension_reason": null,
  "suspended_by": null,
  "counts": {
    "posts": 0, "theses": 0, "comments": 0, "likes_given": 0,
    "message_reports_against": 0
  },
  "recent_content": [
    { "type": "post", "id": "...", "title": "...", "status": "approved", "created_at": "..." }
  ],
  "sanctions": [
    { "action": "user.suspend", "reason": "...", "created_at": "..." }
  ]
}
```

- `email` comes from `supabase.auth.admin.getUserById`, not from `profiles`. If the auth admin client is unavailable, return `email: null` rather than failing the whole dossier.
- `sanctions` is limited to the last 10 audit rows targeting this user. It is returned to `superadmin` only; `admin` receives `[]`. `admin` still sees the current suspension fields.
- Dossier reads are allowed for any existing user, including equal/higher rank. Read is not management.

`PATCH /api/admin/users/:id/role`

```json
{ "role": "faculty", "reason": "Approved department transfer" }
```

- Validates the role against canonical names.
- Enforces the matrix in §10.
- Writes `user.role_change` with `{ from, to }`.

`POST /api/admin/users/:id/suspend`

```json
{ "reason": "Repeated harassment", "until": "2026-11-01T00:00:00.000Z" }
```

- `until` optional. Missing or `null` means indefinite.
- `until` must be in the future if present.
- Sets the profile fields, bans the Supabase Auth user, and revokes refresh sessions.
- Writes `user.suspend`.
- Returns the updated user summary.

`POST /api/admin/users/:id/unsuspend`

```json
{ "reason": "Appeal accepted" }
```

- Clears suspension fields, sets `ban_duration: "none"`, writes `user.unsuspend`.
- Allowed even if the sanction already expired (it clears the stale fields).

`POST /api/admin/users/:id/force-signout`

```json
{ "reason": "Token suspected compromised" }
```

- Superadmin only.
- Revokes refresh sessions. If the account is also suspended, the ban remains.
- Writes `user.force_signout`.
- Documented limitation: an access token issued before the revoke can remain valid until its normal expiry.

`DELETE /api/admin/users/:id`

Body: `{ "reason": "..." }`

- Superadmin only, target strictly below caller, not self.
- Deletes the Supabase Auth user (which revokes sessions), then deletes the profile row. Profile cascades remove posts, theses, comments, likes, messages, and memberships.
- Writes `user.delete` with a snapshot.
- PDF objects remain in storage; this is a known gap, out of scope.
- Returns `{ "message": "User deleted", "id": "..." }`.

### 11.3 Audit

`GET /api/admin/audit?actor_id=&action=&target_type=&target_id=&from=&to=&q=&limit=&cursor=`

- Superadmin only. `admin` gets 403.
- `action` is an exact match; the UI supplies the canonical string.
- `q` searches `target_label`, `actor_username`, and `reason`.
- Returns rows in reverse chronological order: `id`, `actor_id`, `actor_username`, `actor_role`, `action`, `target_type`, `target_id`, `target_label`, `reason`, `metadata`, `created_at`.

There are no write endpoints.

### 11.4 Content

`GET /api/admin/content?type=post|comment|thesis|all&status=approved|flagged|hidden|all&q=&department_id=&author_id=&limit=&cursor=`

- Includes hidden rows.
- Normalizes items to:

```json
{
  "type": "post",
  "id": "...",
  "title": "Post title or comment excerpt",
  "excerpt": "First 240 characters",
  "author": { "id": "...", "username": "...", "full_name": "..." },
  "department_id": "...",
  "department_name": "...",
  "status": "hidden",
  "moderation_reason": "...",
  "created_at": "...",
  "app_path": "/post/..."
}
```

- `app_path` is `null` for a thesis. The panel opens Repository instead.

`POST /api/moderation/posts/:id`, `/comments/:id`, and the new `/theses/:id`

Existing actions become:

```json
{ "action": "approve" | "hide" | "delete", "reason": "Required, 3-500 chars" }
```

- `reason` is mandatory for all three actions.
- `approve` is the restore action and audits as `content.restore`.
- `hide` audits as `content.hide`; `delete` audits as `content.delete`.
- `delete` returns 403 unless the caller is `superadmin`. This applies to the legacy departmentAdmin route too.
- `POST /api/moderation/theses/:id` follows the same contract. `approve`/`hide` update `moderation_status` and `moderation_reason`; `delete` removes the row and leaves PDF storage untouched.
- Department scoping continues to apply to `departmentAdmin`; campus admins are unscoped.
- Hidden content is not visible to non-moderators, preserved from existing behavior.

Message reports keep `POST /api/moderation/message-reports/:id` with `{ "action": "reviewed" | "dismissed", "reason": "..." }`. Audit as `report.review` / `report.dismiss`.

`GET /api/moderation/queue` remains the queue endpoint. It already returns `flaggedPosts`, `flaggedComments`, `messageReports`, and `totalFlagged`. This spec adds `flaggedTheses` to that payload.

### 11.5 Announcements

`POST /api/admin/announcements`

```json
{
  "title": "Enrollment schedule",
  "body": "Enrollment opens Monday at 8:00 AM.",
  "audience": { "type": "all" }
}
```

or

```json
{ "audience": { "type": "role", "role": "student" } }
{ "audience": { "type": "department", "department_id": "uuid" } }
```

- Title 3-120 characters; body 3-2000; plain text.
- Recipients are active, non-suspended profiles in scope, excluding the sender.
- Creates one `notifications` row per recipient: `type = "announcement"`, `actor_id = sender`, `target_id = announcement UUID`, `message = title + "\n\n" + body`, `department_id`/`department` when department-targeted.
- Writes one `announcement.send` audit row with the audience and recipient count.
- Returns `{ "id": "...", "recipients": 4 }`.

`GET /api/admin/announcements/audience-count?type=all|role|department&role=&department_id=`

- Returns `{ "count": 4 }` after applying the same active/non-suspended/exclude-sender rule.
- Both roles may call it.

`GET /api/admin/announcements?limit=&cursor=`

- Both roles may read history.
- Reads audit rows with `action = 'announcement.send'` and returns `{ id, title, body, audience, recipients, actor_username, created_at }`.
- This is a scoped view over audit; it does not grant access to the general audit log.

### 11.6 Existing endpoints that change

| Endpoint | Change |
|---|---|
| `GET /api/users` | Admin/superadmin only. Non-admin consumers move to `GET /api/public/peers`. |
| `GET /api/users/:id` | Self or admin/superadmin only. Other users get 404. |
| `PUT /api/users/:id` | `role` is ignored/rejected. Role writes move to `/api/admin/users/:id/role`. Existing profile-field behavior otherwise remains. |
| `DELETE /api/users/:id` | Self only; non-self requests 403. Console deletion uses the audited superadmin endpoint. |
| `GET /api/admin/departments`, `/courses` | Unchanged paths. Mutations add audit rows. |
| `GET /api/public/peers` | Unchanged path. Frontend consumers migrate here from `/users`. |

`GET /api/public/peers` already returns public-safe fields and stays unauthenticated. The app may call it with or without a token.

---

## 12. Screens

### 12.1 Shell

- Left sidebar, 240-256 px, light theme consistent with the current panel.
- Brand block: "LCCB Connect" + "Admin Console".
- Nav groups:
  - **Governance:** Overview, Users, Reports & Content, Announcements.
  - **System:** Audit (superadmin only), Departments & Courses, Settings.
- Active item uses the existing blue fill.
- Bottom: signed-in user, role badge, **Back to App**, **Sign Out**.
- Main area: page header with title, one-line description, refresh action; content below.
- At `<768px`, render the existing desktop-only fallback with a **Back to App** button.
- `(admin)/_layout.tsx` must check the profile: non-admin roles are redirected to `/(tabs)`. While the profile loads, show a spinner. The server remains the authority.

**Back to App:** `router.push("/(tabs)")`. Same session, same profile, no sign-out.

**App return link:** in the desktop top bar (`frontend/app/(tabs)/_layout.tsx`), show an **Admin Console** item with a shield icon when `isAdminRole(profile.role)` and width `>= 768`. It navigates to `/(admin)`. Hidden on mobile and for all other roles.

### 12.2 Overview

- Four KPI cards: Total users, Content items (posts + theses), Open reports, Active last 7 days. Hidden and flagged counts are broken out in the secondary strip.
- Secondary strip: users by role, content by status, announcements sent in 30 days.
- **Needs attention** table (max 10): kind, item, author, age, open button. Kinds: flagged post, flagged comment, flagged thesis, reported message. Oldest first. Button opens the relevant queue item.
- **Recent actions** panel for superadmin only: time, actor, action, target. Link to the filtered audit view.
- Empty states with a link to the relevant screen.
- All counts come from one overview call; no client-side aggregation of full tables.

### 12.3 Users

- Server-side search and filters: role, department, status.
- Columns: User (avatar, name, `@username`), Role, Department, Status, Joined, Last active, View.
- Status chips: Active, Suspended (with "until" date), Suspended (indefinite).
- Cursor pagination. Empty state explains that accounts are created through registration.
- Row click opens the dossier. No inline destructive actions.

### 12.4 User dossier

Route: `(admin)/users/[id]`.

Sections:

1. **Header:** avatar, name, username, email, role badge, status badge, joined, last active.
2. **Identity:** department, course, year level, bio, skills.
3. **Governance actions:**
   - Role select limited to roles the caller may grant. Save opens a reason dialog.
   - Suspend / Unsuspend with reason and optional end date.
   - Force sign-out (superadmin only) with reason.
   - Delete user (superadmin only) with reason plus typing the username to confirm.
   - Self and equal/higher-rank targets show disabled controls with an explanation.
4. **Activity:** counts for posts, theses, comments, likes given, reports against.
5. **Recent content:** up to 5 items with status chips and an open-in-app action.
6. **Sanctions:** current suspension plus the last 10 audit entries (superadmin only).

Every action refreshes the dossier and shows a success or error banner. No optimistic removal of the user.

### 12.5 Reports & Content

One screen, two tabs.

**Queue tab**

- Four sections: Flagged posts, Flagged comments, Flagged theses, Reported messages.
- Each row: type icon, title/excerpt, author, reason, age.
- Actions:
  - Post/comment/thesis: **Restore**, **Hide**, **Delete** (superadmin only).
  - Message report: **Resolve**, **Dismiss**.
- Clicking a row opens a detail drawer with the full text, author, timestamps, moderation history, and **Open in app**.
- Every action opens the reason dialog. Confirm is disabled until the reason has at least 3 characters.
- Delete requires the reason plus a second confirmation.
- After success, remove the row from the queue and refresh counts.
- Hidden/failed states are explicit; no silent failures.

**Library tab**

- Filters: type, status, department, search.
- Columns: Type, Title/excerpt, Author, Department, Status, Created, Actions.
- Actions: Restore, Hide, Delete (superadmin only), Open in app.
- Includes hidden and flagged content.
- Cursor pagination.
- Thesis "Open in app" goes to Repository and explains that thesis detail is not deep-linkable in v1.

### 12.6 Announcements

- Two-column desktop layout: composer left, preview/history right.
- Composer fields: title, body, audience (`Everyone`, `Role`, `Department`), conditional role/department picker, live recipient count, Send.
- Send opens a confirmation dialog: audience, recipient count, and a note that it cannot be edited or deleted after sending.
- Disable Send for zero recipients.
- History table: sent time, title, audience, recipients, sender. Click opens a read-only detail.
- After send: success banner with recipient count; composer clears; history refreshes.
- Notification rows appear in the existing Notifications screen. Add an announcement icon/branch; no new notification screen.

### 12.7 Audit

Route: `(admin)/audit`, superadmin only.

- Filters: actor, action, target type, target id, date range, free text.
- Table: time, actor, action label, target, reason, expand.
- Expanded row shows metadata pretty-printed.
- Cursor pagination, newest first.
- Read-only. No edit/delete controls, no bulk delete.
- Admin users never see the nav item; direct navigation shows a 403 state and redirects.

### 12.8 Suspended account

- New `app/suspended.tsx`, outside `(tabs)`.
- AuthContext detects `code === "account_suspended"` on the profile fetch, stores the reason/until, and RouteGuard redirects here.
- Shows the reason, end date (or "Indefinite"), and a Sign Out button.
- Sign Out uses the Supabase client directly, so it works even while the API is blocked.
- Signing back in while banned fails at Supabase; the screen copy tells the user to contact administration.

### 12.9 Existing screens

`departments.tsx` and `settings.tsx` keep their current capabilities and visual language. They get the new shell automatically. Catalog mutations add audit rows.

---

## 13. Frontend behavior

### 13.1 Role utility

`src/lib/roles.ts`:

```ts
export type CanonicalRole = "student" | "faculty" | "departmentAdmin" | "admin" | "superadmin";
export const ROLE_RANK: Record<CanonicalRole, number>;
export function normalizeRole(role?: string | null): CanonicalRole | null;
export function isAdminRole(role?: string | null): boolean;
export function canManageRole(caller: string | null | undefined, target: string | null | undefined): boolean;
export function grantableRoles(caller: string | null | undefined): CanonicalRole[];
```

It normalizes `superAdmin`, `superadmin`, `department_admin`, and `departmentAdmin`. Use it in RouteGuard, the panel layout, the tabs return link, and the dossier. Remove the duplicated rank table from `(admin)/users.tsx`.

### 13.2 Data layer

`src/lib/adminApi.ts` exports typed functions:

```ts
getOverview()
listUsers(params)
getUserDossier(id)
changeRole(id, role, reason)
suspendUser(id, reason, until?)
unsuspendUser(id, reason)
forceSignOut(id, reason)
deleteUser(id, reason)
listContent(params)
listAudit(params)
sendAnnouncement(input)
getAudienceCount(input)
listAnnouncements(params)
```

Every function uses `apiFetch`, checks `res.ok`, and throws a typed `AdminApiError` carrying `status`, `code`, and `message`. The UI renders those messages; it does not show raw server objects.

### 13.3 Loading and failure rules

- Tables keep the previous rows visible while refreshing, with a subtle loading state.
- First load uses skeletons or a centered spinner.
- 403 rank errors show an inline banner, not a toast that disappears.
- 404 target errors refresh the list and show "This item no longer exists."
- 500/502/503 errors preserve the dialog and allow retry.
- All destructive dialogs trap focus, close on Escape, and have an explicit Cancel.

### 13.4 Pagination

- Cursor from the response; never compute offsets.
- "Load more" appends items. Filters reset the cursor.
- Total count is displayed from `total`.

### 13.5 Accessibility

- Tables are semantic on web where possible; rows are keyboard reachable.
- Every icon-only button has an accessibility label.
- Focus returns to the trigger after a dialog closes.
- Status is never conveyed by color alone; chips include text.
- Reason dialogs label the required field and announce validation errors.

---

## 14. Migration and rollout

1. Review this spec.
2. Add `010_superadmin_console.sql` and update `backend/schema.sql`.
3. Apply with:
   ```bash
   cd backend
   node scripts/run-sql.js migrations/010_superadmin_console.sql
   ```
4. Verify:
   ```bash
   node scripts/audit-database.js
   ```
   Confirm the new table, four columns, indexes, trigger, RLS, and revokes.
5. Implement `foundation` and `admin-api`.
6. Add backend tests; run `cd backend && npm test`.
7. Implement the panel shell and screens.
8. Run `cd frontend && npx tsc --noEmit` and `npx expo lint`. The repo has pre-existing React Compiler lint errors; no new errors.
9. Run manual QA by role.
10. Update `DATABASE.md` with the new table/columns and the verified status.

The migration is idempotent: `IF NOT EXISTS` for columns/tables/indexes, drop-and-recreate for the trigger, and a guarded check constraint.

---

## 15. Testing

### 15.1 Automated backend

Add `backend/tests/admin.test.js` (split if it grows past ~400 lines). Use the existing `node:test` + `supertest` patterns and model spies.

Required cases:

1. Unauthenticated requests to `/api/admin/*` return 401.
2. `student`, `faculty`, and `departmentAdmin` get 403 on every admin route.
3. `admin` can list users, read a dossier, suspend a lower role, hide content, send an announcement, and read announcement history.
4. `admin` gets 403 on: audit read, force sign-out, delete user, delete content, grant `admin`, grant `superadmin`.
5. `superadmin` can perform every action in the matrix.
6. Self role change, self suspend, self force sign-out, and self delete return 403.
7. Equal/higher-rank management returns 403; nonexistent targets return 404.
8. Granting a role not permitted to the caller returns 403.
9. Suspending a user writes the profile fields, calls the auth ban, revokes sessions, and writes exactly one audit row.
10. `requireActiveAccount` rejects a suspended profile with `code: "account_suspended"` and allows an expired suspension.
11. Every content moderation action requires a reason and writes the right audit action.
12. Content delete is superadmin-only.
13. Theses can be hidden, restored, and deleted through the moderation route.
14. Announcement fan-out inserts the expected number of notifications and excludes suspended users and the sender.
15. Announcement audience count matches the fan-out.
16. `GET /api/users` is admin-only; `/api/public/peers` remains open and sanitized.
17. `PUT /api/users/:id` cannot change a role; `DELETE /api/users/:id` cannot delete another user.
18. Audit rows are read-only at the API level (no write routes).
19. Content explorer includes hidden rows for admins and filters by status/type/query.
20. Overview returns the documented shape for both roles, with `recent_actions` empty for `admin`.

Add a migration/manual check for the append-only trigger:

```sql
UPDATE public.admin_audit_log SET reason = 'tampered' WHERE id = '<row>';
-- expected: ERROR: admin_audit_log is append-only
```

### 15.2 Frontend checks

- `npx tsc --noEmit` clean.
- `npx expo lint` has no new errors beyond the known React Compiler baseline.
- Manual keyboard pass over dialogs and tables.
- At 768 px and 1440 px, no horizontal scroll on the shell; tables scroll inside their own container.

### 15.3 Manual QA by role

Use the seeded accounts.

| # | Account | Check |
|---|---|---|
| 1 | `superadmin@lccb.edu.ph` | Login lands on `/(admin)`; all nav items; overview populated; Audit visible. |
| 2 | `admin@lccb.edu.ph` | Login lands on panel; Audit hidden; no delete/force-sign-out controls; role options do not include `admin`. |
| 3 | `student@lccb.edu.ph` | Login lands on feed; direct `/(admin)` redirects to feed; `/api/admin/overview` returns 403. |
| 4 | `faculty@lccb.edu.ph` | Same as student for panel access. |
| 5 | `deptadmin@lccb.edu.ph` | Same as student for panel access; existing department moderation still works. |
| 6 | superadmin | Back to App opens feed; Admin Console link returns to panel; no re-login. |
| 7 | superadmin | Change a student to faculty with a reason; audit row appears; user sees the new role. |
| 8 | admin | Attempt to grant `admin`; 403; no audit row. |
| 9 | superadmin | Suspend a student with a reason; student's next request gets the suspended screen; unsuspend restores access. |
| 10 | superadmin | Force sign-out a faculty account; refresh token is rejected; account can sign in again. |
| 11 | superadmin | Delete a disposable test user; auth user and profile are gone; audit row remains. |
| 12 | admin | Hide an approved post with a reason; it disappears from the public feed; restore brings it back. |
| 13 | admin | Delete a post; 403. |
| 14 | superadmin | Delete a post; audit row written; open-in-app returns 404. |
| 15 | admin | Send an announcement to students; only students receive it; history shows the count. |
| 16 | superadmin | Audit filter by actor and action returns the expected rows; no edit/delete controls. |
| 17 | any suspended account | Sign out from the suspended screen works. |

---

## 16. Boundaries

### Always

- Run `cd backend && npm test` before claiming backend work is done.
- Run `npx tsc --noEmit` and `npx expo lint` before claiming frontend work is done.
- Enforce every permission on the server; client checks are only affordances.
- Require a reason for every mutation in this console.
- Write exactly one audit row per successful mutation.
- Return 404 for unknown targets.
- Keep the service-role key server-side.
- Keep `schema.sql` and `DATABASE.md` in sync with migrations.

### Ask first

- Any schema change beyond migration 010.
- Any new dependency.
- Changing authentication or registration flows.
- Deleting rows outside the documented admin actions.
- Changing the permission matrix or role vocabulary.
- Adding email/push delivery.

### Never

- Trust a role, actor id, or target id from the request body.
- Authorize from the frontend only.
- Add audit update/delete endpoints.
- Expose the service-role key to the client or logs.
- Allow self role changes, self suspension, self force-sign-out, or self deletion.
- Let `admin` grant `admin`/`superadmin`, delete content/users, force sign-out, or read the full audit log.
- Delete auth users without deleting the profile (or vice versa) and reporting the failure.
- Edit vendor directories.
- Commit `.env` or secrets.

---

## 17. Acceptance criteria

The console is done when all of these are true:

1. Logging in as `admin` or `superadmin` lands on `/(admin)` on desktop; logging in as any other role lands on `(tabs)`.
2. `(admin)` is inaccessible to non-admin roles, both by redirect and by server 403.
3. The sidebar contains Overview, Users, Reports & Content, Announcements, Departments & Courses, Settings; Audit appears only for superadmin.
4. The overview shows real counts and a needs-attention list, not placeholders.
5. The users table searches/filters/paginates and opens a dossier with identity, counts, recent content, and governance actions.
6. Role changes follow the matrix and cannot touch self or equal/higher ranks.
7. Suspension blocks the account on the next API request and is reversible; the suspended screen appears with the reason and end date.
8. Force sign-out and user deletion are superadmin-only and audited.
9. Content can be hidden, restored, and deleted with mandatory reasons; delete is superadmin-only; theses are covered.
10. Message reports can be resolved or dismissed with reasons.
11. Announcements target everyone, a role, or a department; recipients get an in-app notification; history shows the count.
12. Every privileged mutation writes one immutable audit row with actor snapshot, target, reason, and metadata.
13. Admin cannot read the full audit log, force sign-out, hard-delete, or grant `admin`/`superadmin`.
14. `GET /api/users` is no longer a directory for ordinary users; the app uses `/api/public/peers`.
15. Back to App opens the feed as the same identity; Admin Console returns to the panel.
16. Backend tests pass; TypeScript is clean; no new lint errors.
17. `DATABASE.md` documents migration 010 as applied and verified.

---

## 18. Open questions

Defaults are chosen; none blocks implementation unless the reviewer disagrees.

1. **Force sign-out mechanism.** The installed Supabase JS SDK exposes `auth.admin.signOut(jwt)`, which needs the user's token, not their id. Default: revoke `auth.sessions`/`auth.refresh_tokens` for the user id with the owner connection. Verify the refresh token is rejected on the next refresh. If GoTrue exposes a by-id admin logout in this deployment, prefer it.
2. **Audit retention.** Default: keep indefinitely in v1. No purge job. Revisit if the table grows.
3. **Announcement store.** Default: no separate table; notification fan-out plus audit-derived history. If announcements need editing, scheduling, or delivery status later, add a dedicated table in v1.1.
4. **Dossier email visibility.** Default: visible to both `admin` and `superadmin` for account identification. Tighten to superadmin only if policy requires it.
5. **Thesis deep links.** Default: no new thesis detail route; "Open in app" goes to Repository. Add `/thesis/[id]` only if thesis moderation volume justifies it.
