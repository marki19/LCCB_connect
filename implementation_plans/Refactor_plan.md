# Refactor Plan — free-text `course`/`department` → catalog `department_id`

**Status:** ✅ implemented and verified — migration `005` applied live; backend
tests 65/65; frontend `tsc --noEmit` clean; no new lint errors.
**Goal:** make `department_id` (the admin-managed catalog UUID) the **single source of
truth** for departmental access, so that **renaming or reordering a department can never
change who may moderate or who gets notified**. This is the last blocker before Phase 1
(messaging), because the permission engine and moderation scope must agree on identity.

---

## 1. Why this refactor

Phase 0 already added `profiles.department_id` (uuid) + the catalog. But the **access
logic still reads free text**:

| Concern | Current (free text) | File |
|---|---|---|
| Dept-admin moderation scope | `req.profile.course` vs author's `pr.course`, `LOWER()` compare | `controllers/moderationController.js:19-24, 45, 77, 122` |
| Moderation queue filter | `LOWER(pr.course) = LOWER($1)` | `models/postModel.js:265-311` |
| Notification targeting | `LOWER(course) = LOWER($1)` | `services/notificationService.js:8-19` |
| Notifications on create | `req.profile?.course` | `postController.js:54, 136`; `thesisController.js:51` |
| Thesis department | client free-text, `NOT NULL` | `models/thesisModel.js:47, 78-96`; `schema.sql:47` |
| UI display + filter | `author.course`, hardcoded `["BSIT","BSCS","BSIS"]` | `(admin)/content.tsx:49-84, 211`; `(tabs)/index.tsx:48,70,106`; `profile.tsx:23`; `messages.tsx:29` |

Two users spelling the same department `"BSIT"` vs `"BSIT "` vs `"bsit"` currently
collide; a renamed department silently re-scopes every moderator. That is the bug class
this removes.

---

## 2. Target model

- **Authorization / scoping / notification targeting** → `department_id` (uuid), exact
  equality, **fail-closed** when either side is null.
- **Display** → `departments.name`, joined on demand. Never the access key.
- **Legacy text columns are demoted to denormalized display values**, not removed
  (`profiles.course`, `theses.department`, `notifications.department`), so nothing that
  still reads them breaks. They are no longer consulted for any decision.
- **Posts/comments are NOT denormalized.** A post/comment belongs to its
  **author's current department** (joined live), matching today's behaviour. If an admin
  later moves a user, their content moves with them.
- **A thesis** belongs to its **uploader's department**, derived server-side at creation.

---

## 3. Database — migration `005_department_scope.sql`

```sql
-- Theses: authoritative department link, derived from the uploader.
ALTER TABLE public.theses
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.theses ALTER COLUMN department DROP NOT NULL;  -- campus admins may have none

-- Notifications: target department admins by id.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_theses_department_id        ON public.theses(department_id);
CREATE INDEX IF NOT EXISTS idx_notifications_department_id ON public.notifications(department_id);
-- idx_profiles_department already exists (migration 004).
```

- **No data backfill.** Existing `theses.department` text is preserved for display;
  `department_id` stays null until a thesis is (re)created, and moderation fails closed.
  (There is no free-text→catalog mapping to infer, and the catalog is still empty.)
- `schema.sql` updated to match. Applied live via
  `node backend/scripts/run-sql.js backend/migrations/005_department_scope.sql`.

---

## 4. Backend changes

**`models/postModel.js`**
- `getAllPosts`, `getPostById`, `getComments`, `getCommentById`, `getFlaggedPosts`,
  `getFlaggedComments`: add `'department_id', pr.department_id` and
  `'department_name', d.name` to the author JSON, and
  `LEFT JOIN public.departments d ON d.id = pr.department_id`.
- `getFlaggedPosts({ departmentId })` / `getFlaggedComments({ departmentId })`: replace
  the `LOWER(pr.course)` predicate with `AND pr.department_id = $1::uuid`.

**`controllers/moderationController.js`**
- `withinDepartmentScope(req, res, contentDepartmentId)`: compare
  `req.profile.department_id` to the content author's `department_id` (exact uuid),
  403 + return false when either is missing or they differ. `isAdmin(req)` bypass unchanged.
- `moderatePost` / `moderateComment`: pass `post.author?.department_id` /
  `comment.author?.department_id`.
- `getModerationQueue`: campus admin → `req.query.department_id` (validated uuid, else
  ignored/null); department admin → `req.profile.department_id`. Response returns
  `department_id` (+ resolved `department_name` for display).

**`services/notificationService.js`**
- `getTargetAdmins(departmentId)`: campus admins always; department admins **only when
  `$1 IS NOT NULL AND department_id = $1::uuid`** (fixes the current bug where a
  campus-wide event with no department pings *every* department admin).
- `createNotifications`: store `department_id` **and** the denormalized name.
- `notifyAdminsOnPostCreated(post, author)` → `author.department_id` / `author.department_name`.
- `notifyAdminsOnThesisCreated(thesis, uploader)` → `thesis.department_id` / name.
- `notifyAdminsOnFlaggedContent({ …, departmentId, departmentName })` → by id.

**`controllers/postController.js` / `controllers/thesisController.js`**
- Pass `departmentId: req.profile?.department_id` and `departmentName: req.profile?.department_name`
  (posts/comments/flagged). Thesis passes the derived values.

**`models/thesisModel.js`**
- `createThesis`: accept `department_id` + `department` (name) **derived by the controller
  from the uploader**; insert both. Remove `department` from the client path.
- `THESIS_UPDATABLE_COLUMNS`: drop `department` (not client-editable).
- `getAllTheses` / `getThesisById`: expose `t.department_id` and the uploader's
  `department_name`.

**`validation/index.js`**
- Remove `department` from the thesis create/update schemas. `.strict()` then rejects a
  client-supplied `department` with 400 — the department is server-derived, never chosen.

**`controllers/publicController.js`**
- `getPeers`: return `department_id` + `department_name` (keep `course` for back-compat).

---

## 5. Frontend changes

- **`app/(admin)/content.tsx`** — the core UI fix: replace the hardcoded
  `["All","BSIT","BSCS","BSIS"]` with the live catalog (campus admin: `GET /public/departments`;
  dept admin: fixed to their own, no picker). Filter `allPosts` by `author.department_id`.
  Queue uses `?department_id=<uuid>`. Display `department_name`.
- **`app/upload-thesis.tsx`** — remove the free-text department input; show the uploader's
  department read-only (from `profile.department_name`); stop sending `department`.
- **`app/(tabs)/index.tsx`, `app/messages.tsx`, `app/(admin)/users.tsx`, `app/(tabs)/profile.tsx`,
  `app/(tabs)/search.tsx`, `src/components/PostCard.tsx`** — display `department_name`;
  drop the `"BSIT"` / `"LCCB Research"` fallbacks (use `"—"` / "No department").
- Types in `src/types.ts` gain `department_name?` on the author/uploader/peer shapes.

---

## 6. Tests + docs

- **`tests/routes.test.js`**: moderator stub profile gets `department_id`; author stubs
  return `department_id`; replace the "case/whitespace insensitive" assertions with
  **same-uuid allowed** / **different-uuid 403**; keep both fail-closed cases.
- **`tests/routes.test.js`** thesis create: stop sending `department`; assert the external
  `pdf_url` is still rejected.
- `catalog.test.js` unaffected. Target remains **all tests green**.
- Update `Messaging_plan.md` (deferred-refactor note → done) and `Security_plan.md` if touched.

---

## 7. Behaviour changes / risks

| Change | Effect | Mitigation |
|---|---|---|
| Exact uuid compare | `"BSIT"` vs `"bsit "` collisions disappear | intended |
| Dept admins w/o `department_id` fail closed | a dept admin with no department can moderate nothing | correct: assign a department; gate already forces it |
| Campus-wide → not all dept admins | fewer notifications for no-department content | only campus admins act campus-wide |
| Theses derive department from uploader | cannot attribute a thesis to another dept | admins upload with their own dept; revisit if needed |
| Live author department | content follows the author if admins move them | consistent with today |

---

## 8. Verification

1. `node backend/scripts/run-sql.js backend/migrations/005_department_scope.sql` → `OK`.
2. `cd backend && npm test` → all pass.
3. `cd frontend && npx tsc --noEmit` → clean; `npx expo lint` → no *new* errors.
4. Manual: dept admin sees only own-department queue; campus admin filter lists real
   departments; thesis upload auto-fills department.

---

## 9. Decisions (resolved)

1. **Thesis department** — **derive from uploader** (the free-text picker was removed;
   the upload form shows the uploader's department read-only).
2. **Campus-wide (no-department) notifications** — **campus admins only** (fixes the
   `$1 IS NULL OR ...` fan-out).
3. **Frontend sweep** — **full display sweep** included.

## 10. Verification (done)

- `node scripts/run-sql.js migrations/005_department_scope.sql` → `OK`; columns +
  indexes confirmed live (`theses.department` now nullable, `department_id` uuid,
  `notifications.department_id` uuid, both indexes present).
- `cd backend && npm test` → **65/65 pass** (added: same-department allowed,
  client-supplied `department` rejected).
- `cd frontend && npx tsc --noEmit` → clean.
- `npx eslint` on changed files → only the repo's **pre-existing** React-Compiler
  errors (none on lines this refactor touched).
- `schema.sql` corrected so a fresh install creates the catalog FKs after
  `departments`/`courses` (idempotent DO block).
