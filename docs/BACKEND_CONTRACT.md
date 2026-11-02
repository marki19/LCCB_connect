# LCCB Connect — Backend Contract

> **Audience:** anyone building UI against this backend (human or AI).
> **Source of truth:** the Express code under `backend/`. This document is a hand-maintained mirror of it.
> **Verified:** 2026-10-20 against the current working tree. Route count: **85 API routes** plus `GET /` (health).
> **Re-verify before trusting the route list:**
>
> ```bash
> cd backend
> node scripts/list-routes.js          # human-readable, grouped by mount
> node scripts/list-routes.js --json   # machine-readable
> ```
>
> If this document and the code disagree, **the code wins**. Tell the backend maintainer so the contract can be fixed. Do not “fix” the backend to match the doc.

---

## 0. Rules for UI work

1. **Backend code is read-only.** Do not edit `backend/`, `backend/schema.sql`, `backend/migrations/`, or `backend/scripts/` as part of UI work.
2. **Never invent an endpoint.** If a control needs data that no route below provides, the control is blocked. Log the missing capability in [`docs/API-REQUESTS.md`](./API-REQUESTS.md) and render a disabled control with a short reason. Do not fake success, seed local mock rows, or call Supabase tables directly.
3. **Every interactive control must map to a route in this document.** A button that changes state without a documented write route must not ship.
4. **Use the existing client helpers.** `frontend/src/lib/api.ts`, `adminApi.ts`, `messages.ts`, `catalog.ts`, `upload.ts`, and `realtime.ts` already implement this contract. Prefer them over new fetch wrappers.
5. **Role checks in the UI are cosmetic.** The server enforces every permission. Hiding an action is UX; it is not security.
6. **Supabase Auth, Storage, and Realtime are part of the contract** (sections 8–10). Direct Postgres/table access is not.

---

## 1. Stack and base URL

| Item | Value |
| --- | --- |
| API framework | Express 5 on Node.js |
| API base path | `/api` (all endpoints below include it) |
| Local base URL | `http://localhost:3000/api` |
| Client configuration | `frontend/src/lib/api.ts` reads the configured API URL; do not hard-code a different host in screens |
| Body format | JSON only, UTF-8 |
| Max body size | 1 MB (`413 { "error": "Request body too large" }`) |
| Auth | Supabase Auth access token as `Authorization: Bearer <token>` |
| Database | Supabase Postgres (the API is the only supported read/write path) |
| Storage | Supabase Storage buckets `assets` and `theses` |
| Realtime | Supabase Realtime channels (messages, presence, typing) |
| CORS | Enabled by the server; mobile clients are unaffected |

`GET /` (outside `/api`) returns `{ "message": "Backend is running!" }` and is only a health check.

---

## 2. Authentication and account lifecycle

### 2.1 Sign-up and sign-in

Authentication happens **client-side through Supabase**, not through this API:

1. `supabase.auth.signUp({ email, password })` or `supabase.auth.signInWithPassword(...)`.
2. The app receives a Supabase session and access token.
3. Every API call sends `Authorization: Bearer <access_token>`.

`apiFetch` / `apiJson` in `frontend/src/lib/api.ts` attach the token automatically. Do not build a second token store.

Current Supabase Auth surface used by the app:

| Action | Call | Notes |
| --- | --- | --- |
| Sign up | `supabase.auth.signUp({ email, password, options.data })` | `options.data.full_name` seeds user metadata |
| Sign in | `supabase.auth.signInWithPassword({ email, password })` | Existing login screen |
| Sign out | `supabase.auth.signOut()` | `AuthContext.signOut` also clears local state |
| Session restore | `supabase.auth.getSession()` + `onAuthStateChange` | Owned by `AuthContext` |
| Guest | `AuthContext.signInAsGuest()` | Local only; no Supabase session |
| Password reset | **not implemented** | If designed, use `supabase.auth.resetPasswordForEmail` plus a configured deep link; this is not an API route |

Do not add a custom `/auth/login` API route. Authentication is Supabase's job; this backend only verifies tokens.

### 2.2 Profile bootstrap

After the first sign-in, the app must ensure a profile row exists:

- `POST /api/users` creates **or upserts the caller's own profile** (the id comes from the verified token, never from the body).
- It returns `201` with the profile.
- `GET /api/users/:id` for the caller returns `404 { "message": "User not found" }` when no profile exists yet.
- `role` and `id` are stripped/rejected; a caller can never self-assign a role.

The existing `AuthContext` already performs this bootstrap and falls back to creating a profile when the fetch 404s.

**Email confirmation:** if Supabase “Confirm email” is enabled, `signUp` returns a user but **no session**. A `POST /users` immediately after sign-up will then return `401`. Create/retry the profile after the first successful sign-in; the upsert is idempotent. Confirm the project's Supabase setting before promising an instant post-signup profile.

### 2.3 Onboarding gate (frontend-enforced)

The app requires a department and course before entering the main tabs. The backend only validates that the ids are real and active; it does not force completion. Keep the existing gate in the UI.

- Departments/courses come from `GET /api/public/departments` and `GET /api/public/departments/:id/courses`.
- **Non-admin users may claim department/course only once.** Later `PUT /api/users/:id` calls silently ignore those fields (the API still returns `200`). Treat department/course as read-only after onboarding for non-admins.

### 2.4 Token and suspension behavior

| Situation | Response |
| --- | --- |
| No `Authorization` header | `401 { "error": "Authentication required" }` |
| Invalid/expired token | `401 { "error": "Invalid or expired token" }` |
| Suspended account, any route except `GET /users/:id` for self | `403 { "error": "Account suspended", "code": "account_suspended", "suspended_until": "<ISO or null>", "reason": "<string or null>" }` |
| Insufficient role | `403 { "error": "Forbidden: ...", ... }` |

A suspended user can still read **their own** profile so the suspension screen can show the reason and end date. Every other authenticated route is blocked. The client must detect `code === "account_suspended"` and route to the existing suspended screen.

### 2.5 Guest mode

`guest` is a **frontend-only** mode (`AuthContext.signInAsGuest`). There is no `guest` database role and no guest token.

When there is no session and the method is `GET`, `apiFetch` rewrites:

- `/posts...` → `/public/posts...`
- `/theses...` → `/public/theses...`

`/users...` is **not** rewritten. Guests must call `/public/peers` explicitly; `/users/:id` returns `401` because it has no public equivalent.

Consequences:

- Guests can read public posts/theses/peers/departments/courses only.
- A guest **cannot** use `/users/:id`; call `/public/peers` or another `/public/*` route explicitly in new guest code.
- Any guest write reaches an authenticated route and returns `401`.
- Realtime and push are not started for guests.

---

## 3. Roles and permissions

### 3.1 Roles

Stored spellings may be legacy (`superAdmin`, `department_admin`); comparisons normalize case and separators.

| Role | Meaning | Rank |
| --- | --- | --- |
| `student` | Undergraduate/graduate student | 0 |
| `faculty` | Adviser/reviewer | 1 |
| `departmentAdmin` | Department head/dean | 2 |
| `admin` | Campus administrator | 3 |
| `superadmin` | System owner | 4 |
| `guest` | Frontend-only mode; never in the database | 0 (if ever seen) |

### 3.2 What each role can do

| Capability | student | faculty | departmentAdmin | admin | superadmin |
| --- | --- | --- | --- | --- | --- |
| Public reads | yes | yes | yes | yes | yes |
| Create posts/comments/theses, like, message, friends | yes | yes | yes | yes | yes |
| Moderation queue + notifications | no | no | own department | all | all |
| Hide/restore content | no | no | own department | all | all |
| Permanently delete content | no | no | no | no | yes |
| Admin console (`/admin/*` except catalog) | no | no | no | yes | yes |
| Catalog management (`/admin/departments`, `/admin/courses`) | no | no | no | yes | yes |
| Audit log | no | no | no | no | yes |
| Force sign-out, delete account | no | no | no | no | yes |
| Change roles | no | no | no | student/faculty/departmentAdmin only | anyone |
| Suspend/unsuspend | no | no | no | student/faculty/departmentAdmin only | anyone |

Additional rules:

- **Rank:** an admin cannot manage another `admin` or a `superadmin`. Nobody can manage their own account through admin endpoints.
- **Department scope:** a `departmentAdmin` can only moderate content whose author belongs to the same department. If the moderator has no department, the queue fails closed with `403`.
- **Ownership:** post/comment/thesis edits and deletes are author-only; a non-owner receives `404`, not `403`.
- **Conversation privacy:** a non-participant receives `404` for every conversation/message route.
- **Blocked pairs:** sending a message or friend request returns a deliberately generic `403 { "error": "This user isn't accepting messages" }`. Do not reveal whether a block or a policy caused it.

---

## 4. Conventions

### 4.1 Error envelope

Most errors:

```json
{ "error": "Human-readable message" }
```

Zod validation failures (routes using the shared `validate` middleware):

```json
{
  "error": "Validation failed",
  "fields": [
    { "path": "title", "message": "String must contain at most 200 character(s)" }
  ]
}
```

A few older read/ownership handlers return `{ "message": "..." }` instead of `{ "error": "..." }` (user/post/thesis “not found”, delete responses). **UI error handling must read `error ?? message ?? "Request failed"`.**

Common statuses:

| Status | Meaning |
| --- | --- |
| `200` | Success |
| `201` | Created (also returned by `POST /users` when upserting an existing profile) |
| `400` | Invalid body, catalog reference, action, or query filter |
| `401` | Missing/invalid token |
| `403` | Role, rank, department scope, suspension, block, or ownership action denied |
| `404` | Missing row, non-owner, or non-participant (privacy) |
| `409` | Duplicate catalog name/code; duplicate friend request |
| `413` | Body over 1 MB |
| `429` | Rate limit exceeded |
| `500` | Unexpected server failure (`{ "error": "Internal server error" }`) |
| `503` | Supabase admin auth service unavailable |

### 4.2 Validation

Write bodies are validated with **strict** Zod schemas: unknown keys cause a `400`, not a silent ignore. Send only documented keys.

Exceptions (no strict schema, so extra keys are ignored): moderation action bodies and `POST /posts/preview`.

### 4.3 Pagination

`limit` is clamped to **1–100**. Defaults: **100** for ordinary lists; **20** for `/public/peers`; **25** for admin lists.

| Endpoint family | Cursor |
| --- | --- |
| `/posts`, `/theses`, `/admin/users`, `/admin/content`, `/admin/audit` | Opaque `"<created_at>|<id>"` (descending pages) |
| `/users` (admin directory) | Last `id` (ascending pages) |
| Conversations, friends, requests | No cursor, `limit` only |
| Messages | `before_seq` (or `cursor`) for backward pages; `since_seq` for catch-up |
| Notifications | Fixed newest 30; no pagination |

Ordinary list endpoints return a **bare JSON array**. Admin list endpoints return:

```json
{ "items": [], "total": 0, "next_cursor": "<string|null>" }
```

There is no `has_more` field on ordinary lists: infer it from `page.length === limit`.

### 4.4 Rate limits

| Limit | Scope | Default |
| --- | --- | --- |
| Global | Per IP, all `/api` traffic | 120/min |
| Writes | Per IP, POST/PUT/PATCH/DELETE | 30/min |
| Message sends | Per authenticated user | 20/min and 200/day |
| Friend requests | Per authenticated user | 20/min |
| Message reports | Per authenticated user | 10/min |

Opening a conversation (`POST /conversations`) is covered only by the global write limit; the 20/min + 200/day cap applies to `POST /conversations/:id/messages`.

`429` body: `{ "error": "Too many requests, please try again later." }`. Limits are env-tunable on the server.

### 4.5 Dates, ids, and booleans

- All `id` values are UUID strings except profile ids, which are text (Supabase user ids).
- Timestamps are ISO-8601 strings in UTC (Postgres `timestamptz` serialized by `pg`).
- Dates shown in the UI must be parsed as UTC; use the existing formatters.
- `likes`, `comments`, and `unread` are numbers (Postgres `COUNT` is cast to `int`).

### 4.6 Mutation responses are often raw rows

`POST`/`PUT` for posts, comments, and theses return the **raw table row** (`RETURNING *`). They do **not** include joined `author`/`uploader` objects, like/comment counts, or department names. Only the corresponding `GET` endpoints include those.

Therefore: after a successful create/update, merge the response into local state or refetch the resource. Do not expect `response.author` from a create.

---

## 5. Response objects

These are the shapes the UI can rely on. Optional/nullable fields are marked.

### 5.1 Profile

```ts
type Profile = {
  id: string;                    // Supabase user id (text)
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;     // Supabase Storage public URL
  bio: string | null;
  role: "student" | "faculty" | "departmentAdmin" | "admin" | "superadmin" | string;
  course: string | null;         // legacy free text
  course_id: string | null;      // catalog UUID
  course_name: string | null;
  year_level: string | null;
  skills: string[] | null;
  department_id: string | null;  // catalog UUID
  department_name: string | null;
  message_policy: string | null;
  presence_mode: string | null;
  last_seen_at: string | null;
  last_seen_visible: boolean | null;
  suspended_at: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
  suspended_by: string | null;
  created_at: string;
  updated_at?: string;
};
```

### 5.2 Post

```ts
type Post = {
  id: string;
  author_id: string;
  content: string | null;
  type: "text" | "image" | "project" | "capstone" | "website" | "thesis" | string;
  title: string | null;
  technologies: string[] | null;
  github_url: string | null;
  image_url: string | null;      // Supabase Storage URL
  preview_metadata: {
    title?: string | null;
    description?: string | null;
    image?: string | null;
    url: string;
    siteName?: string | null;
  } | null;
  moderation_status: "approved" | "flagged" | "hidden" | string;
  moderation_reason: string | null;
  created_at: string;
  likes: number;                 // present on GET only
  comments: number;              // present on GET only
  author: {
    id: string | null;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    course: string | null;
    year_level: string | null;
    department_id: string | null;
    department_name: string | null;
  } | null;                      // present on GET only
};
```

### 5.3 Comment

```ts
type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  moderation_status: string;
  moderation_reason: string | null;
  created_at: string;
  user: {                        // key is `user`, not `author`
    id: string | null;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    course: string | null;
    department_id: string | null;
    department_name: string | null;
  } | null;
};
```

### 5.4 Thesis

```ts
type Thesis = {
  id: string;
  uploader_id: string;
  title: string;
  abstract: string;
  department_id: string | null;
  department: string | null;     // display name snapshot
  category: "Undergraduate Capstone" | "Graduate Dissertation" | string;
  pdf_url: string;               // Supabase Storage URL
  moderation_status: string;
  moderation_reason: string | null;
  created_at: string;
  uploader: {                    // present on GET only
    id: string | null;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    course: string | null;
    year_level: string | null;
    department_id: string | null;
    department_name: string | null;
  } | null;
};
```

### 5.5 Notification

```ts
type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  target_id: string | null;
  department: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  actor: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};
```

### 5.6 Conversation and message

```ts
type Conversation = {
  id: string;
  status: "active" | "requested";
  requester_id: string | null;
  last_message_at: string | null;
  created_at: string;
  user_a: string;
  user_b: string;
  peer: {
    id: string | null;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    department_id: string | null;
    department_name: string | null;
  } | null;
  last_message: {
    id: string;
    body: string;
    sender_id: string;
    seq: number;
    created_at: string;
  } | null;
  unread: number;                // messages addressed to the caller, unread
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  seq: number;                   // per-conversation ordering key
  body: string;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
};
```

### 5.7 Friends, requests, blocks

```ts
type Friend = {
  peer: {
    id: string | null;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    department_id: string | null;
    department_name: string | null;
  };
  friends_since: string;
};

type FriendRequests = {
  incoming: {
    id: string;
    requester_id: string;
    created_at: string;
    requester: { id: string | null; username: string | null; full_name: string | null; avatar_url: string | null; department_id: string | null; department_name: string | null };
  }[];
  outgoing: {
    id: string;
    addressee_id: string;
    created_at: string;
    addressee: { id: string | null; username: string | null; full_name: string | null; avatar_url: string | null; department_id: string | null; department_name: string | null };
  }[];
};

type Block = {
  blocked_id: string;
  created_at: string;
  peer: { id: string; username: string | null; full_name: string | null; avatar_url: string | null } | null;
  // NOTE: there is no `id` field; the primary key is (blocker_id, blocked_id).
};
```

### 5.8 Department and course

```ts
type Department = {
  id: string;
  name: string;
  code: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type Course = Department & { department_id: string };
```

### 5.9 Admin console objects

```ts
type AdminUser = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  course: string | null;
  course_id: string | null;
  course_name: string | null;
  year_level: string | null;
  department_id: string | null;
  department_name: string | null;
  skills: string[] | null;
  created_at: string;
  last_seen_at: string | null;
  suspended_at: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
  suspended_by: string | null;
  status: "active" | "suspended";
};

type AuditEntry = {
  id: string;
  actor_id: string;
  actor_username: string | null;
  actor_role: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  reason: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
};

type AdminContentItem = {
  type: "post" | "comment" | "thesis";
  id: string;
  title: string;
  excerpt: string;
  author: { id: string | null; username: string | null; full_name: string | null };
  department_id: string | null;
  department_name: string | null;
  status: string;
  moderation_reason: string | null;
  created_at: string;
  app_path: string | null;       // e.g. "/post/<id>"; null for theses
  parent_id: string | null;      // comment's post id
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: { type: "all" } | { type: "role"; role: string } | { type: "department"; department_id: string };
  recipients: number;
  actor_username: string | null;
  created_at: string;
};
```

---

## 6. Endpoint catalog

All paths below include the `/api` prefix. “Signed-in” means a valid, non-suspended account.

### 6.1 Public reads (no token)

| Route | Query | Returns |
| --- | --- | --- |
| `GET /api/public/posts` | `limit`, `cursor`, `q?`, `author_id?` | `Post[]` (hidden posts excluded) |
| `GET /api/public/posts/:id` | — | `Post`; `404 { "error": "Post not found" }` if missing/hidden |
| `GET /api/public/posts/:id/comments` | — | `Comment[]` (hidden comments excluded) |
| `GET /api/public/theses` | `limit`, `cursor`, `q?`, `uploader_id?`, `category?` | `Thesis[]` (hidden theses excluded) |
| `GET /api/public/theses/:id` | — | `Thesis`; `404` |
| `GET /api/public/peers` | `limit` (default 20), `cursor` (last id), `q?`, `department_id?`, `year_level?` | `PublicPeer[]` |
| `GET /api/public/departments` | — | active `Department[]` |
| `GET /api/public/departments/:id/courses` | — | active `Course[]`; `400 { "error": "Invalid id" }` |

`PublicPeer` is a reduced profile:

```ts
{ id, username, full_name, avatar_url, year_level, department_name }
```

These are the only routes a guest may call. They never expose `role`, email, suspension fields, or social settings.

List-filter rules (public and signed-in):

- `q` is trimmed, capped at 100 characters, and matched case-insensitively as a substring. Posts match `title`/`content`; theses match `title`/`abstract`/uploader name/department name; peers match `username`/`full_name`/department name.
- `author_id`, `uploader_id`, and `department_id` must be UUIDs. A malformed value returns `400 { "error": "Invalid <field>" }` before any database call.
- `category` is an exact match. The label `Undergraduate Capstone` also matches legacy rows stored as `Capstone`.
- `year_level` is an exact match, capped at 50 characters. Filters compose with `cursor` pagination.

### 6.2 Profiles and the user directory

| Route | Who | Body / query | Returns |
| --- | --- | --- | --- |
| `GET /api/users` | admin/superadmin | `limit`, `cursor` (last id) | `Profile[]` (admin directory; use `/public/peers` for the in-app directory) |
| `GET /api/users/:id` | self or admin/superadmin | — | `Profile`; `404` for everyone else |
| `POST /api/users` | any signed-in account without a profile (also upserts self) | `ProfileCreate` | `201 Profile` |
| `PUT /api/users/:id` | self; admins may edit lower-ranked users | `ProfileUpdate` | `200 Profile`; `403` otherwise |
| `DELETE /api/users/:id` | **self only** | — | `200 { message, user }`; `403` for admins (use the admin delete route) |

`ProfileCreate` (every key optional; send what you have):

```json
{
  "username": "string <= 50",
  "full_name": "string <= 200",
  "avatar_url": "Supabase Storage URL or null",
  "bio": "string <= 1000",
  "course": "string <= 100 (legacy label)",
  "year_level": "string <= 50",
  "skills": ["string <= 40"],
  "department_id": "uuid or null",
  "course_id": "uuid or null"
}
```

`ProfileUpdate` = the same keys, plus:

`message_policy` is one of `everyone`, `department`, `selected`, `nobody` (not a literal pipe-delimited string).

Notes:

- `id` is never accepted; it is always the token subject.
- `role` is **rejected with `400 { "error": "Role changes must use /api/admin/users/:id/role" }`**. Use the audited admin route instead.
- Catalog ids must reference **active** rows and the course must belong to the department.
- Non-admins cannot change `department_id`/`course_id` after they are set; the server ignores the attempt and still returns `200`.
- `avatar_url` must be a URL inside this project's Supabase Storage (`<SUPABASE_URL>/storage/v1/object/...`), not an arbitrary remote URL.

### 6.3 Social settings, presence, blocks, and device tokens

All routes are signed-in and live under `/api/users`.

| Route | Body | Returns |
| --- | --- | --- |
| `GET /api/users/me/message-policy` | — | `{ message_policy, department_ids: string[] }` |
| `PUT /api/users/me/message-policy` | `{ message_policy, department_ids?: string[] }` | same shape |
| `POST /api/users/me/presence` | `{ mode: "online" \| "away" \| "busy" \| "dnd" \| "invisible" }` | `{ presence_mode }` |
| `POST /api/users/me/heartbeat` | `{ mode?, last_seen_visible? }` | `{ presence_mode, last_seen_at, last_seen_visible }` |
| `POST /api/users/me/device-tokens` | `{ token, platform: "ios" \| "android" \| "web" }` | `201` device-token row |
| `DELETE /api/users/me/device-tokens` | `{ token }` | `{ removed: boolean }` |
| `GET /api/users/me/blocks` | — | `Block[]` |
| `POST /api/users/:id/block` | — | `201` block row; `400` when blocking yourself |
| `DELETE /api/users/:id/block` | — | `{ unblocked: boolean }` |

Message policy values are `everyone | department | selected | nobody`. `selected` uses the `department_ids` allow-list; send at most 200 UUIDs. `department_ids` is only meaningful for `selected`, and the server replaces the whole list when it is provided.

### 6.4 Posts, comments, likes, link previews

| Route | Who | Body / query | Returns |
| --- | --- | --- | --- |
| `GET /api/posts` | signed-in | `limit`, `cursor`, `q?`, `author_id?` | `Post[]` (hidden excluded) |
| `GET /api/posts/:id` | signed-in | — | `Post`; `404 { message }` if hidden/missing |
| `POST /api/posts` | signed-in | `PostCreate` | `201` raw post row |
| `PUT /api/posts/:id` | author only | `PostCreate` (partial) | `200` raw post row; `404` otherwise |
| `DELETE /api/posts/:id` | author only | — | `{ message, post }`; `404` otherwise |
| `POST /api/posts/:id/like` | signed-in | — | `{ liked: boolean }` (toggles) |
| `GET /api/posts/:id/comments` | signed-in | — | `Comment[]` (hidden excluded) |
| `POST /api/posts/:id/comments` | signed-in | `{ content: "string 1..2000" }` | `201` raw comment row |
| `PUT /api/posts/:id/comments/:commentId` | comment author only | `{ content: "string 1..2000" }` | `200` raw comment row; `404` otherwise |
| `DELETE /api/posts/:id/comments/:commentId` | comment author only | — | `{ message, comment }`; `404` otherwise |
| `POST /api/posts/preview` | signed-in | `{ url: "http(s) URL" }` | `{ title, description, image, siteName, url }` |

`PostCreate` (all fields optional; send only what the user filled):

```json
{
  "content": "string <= 5000 or null",
  "type": "text | image | project | capstone | website",
  "title": "string <= 200 or null",
  "technologies": ["string <= 40"],
  "github_url": "http(s) URL or null",
  "image_url": "Supabase Storage URL or null",
  "preview_metadata": {
    "title": "string <= 300 or null",
    "description": "string <= 2000 or null",
    "image": "http(s) URL or null",
    "url": "http(s) URL"
  }
}
```

Notes:

- `type` defaults to `text` server-side if omitted.
- `image_url` must be in this project's Storage; `github_url` and `preview_metadata.image` may be any public http(s) URL.
- The link-preview service blocks localhost/private networks and caps redirects (SSRF protection). Failures return `400 { error }`.
- New posts begin `approved` and may be updated asynchronously to `flagged` by the moderation scan. The create response cannot include that later status; refetch after a short delay if the UI needs it.
- `GET /posts` accepts `q` (title/content) and `author_id` (profile UUID) for server-side search and “posts by user”. Both compose with `cursor`.
- `GET /posts` accepts `cursor` but **does not return** a `next_cursor`; treat a full page as “may have more” and use the last item's `created_at` + `id` as the cursor.
- Likes are idempotent toggles; there is no separate “unlike” route.

### 6.5 Theses

| Route | Who | Body | Returns |
| --- | --- | --- | --- |
| `GET /api/theses` | signed-in | `limit`, `cursor`, `q?`, `uploader_id?`, `category?` | `Thesis[]` (hidden excluded) |
| `GET /api/theses/:id` | signed-in | — | `Thesis`; `404 { message }` |
| `POST /api/theses` | signed-in | `ThesisCreate` | `201` raw thesis row |
| `PUT /api/theses/:id` | uploader only | `ThesisCreate` (partial) | `200` raw thesis row; `404` otherwise |
| `DELETE /api/theses/:id` | uploader only | — | `{ message, thesis }`; `404` otherwise |

`ThesisCreate` (all required on create; partial on update):

```json
{
  "title": "string 1..300",
  "abstract": "string 1..10000",
  "category": "Undergraduate Capstone | Graduate Dissertation",
  "pdf_url": "Supabase Storage URL"
}
```

Notes:

- `department_id` and `department` are derived from the uploader's profile; never send them.
- `category` is validated only as a 1–100 character string; the app currently uses `Undergraduate Capstone` and `Graduate Dissertation`.
- `GET /theses` accepts `q` (title/abstract), `uploader_id` (profile UUID), and `category` for server-side search and “theses by user”. `Undergraduate Capstone` also matches legacy `Capstone` rows. All filters compose with `cursor`.
- `moderation_status` is forced to `approved` on create (the async scan may flag it).
- `pdf_url` must be a Storage URL in bucket `theses`, PDF content, ≤10 MB.

### 6.6 Notifications and moderation

All routes are signed-in.

| Route | Who | Body / query | Returns |
| --- | --- | --- | --- |
| `GET /api/moderation/notifications` | signed-in | — | `{ unread: number, notifications: Notification[] }` (newest 30) |
| `PUT /api/moderation/notifications/:id/read` | owner | — | `Notification` |
| `POST /api/moderation/notifications/read-all` | signed-in | — | `{ message }` |
| `GET /api/moderation/queue` | departmentAdmin/admin/superadmin | `department_id?` (admin only) | `ModerationQueue` |
| `POST /api/moderation/posts/:id` | departmentAdmin (own dept) / admin / superadmin | `{ action, reason }` | `{ message, post? }` |
| `POST /api/moderation/comments/:id` | same | `{ action, reason }` | `{ message, comment? }` |
| `POST /api/moderation/theses/:id` | same | `{ action, reason }` | `{ message, thesis? }` |
| `POST /api/moderation/message-reports/:id` | same | `{ action: "reviewed" \| "dismissed", reason }` | `{ message, report }` |

`ModerationQueue`:

```ts
{
  department_id: string | null;
  totalFlagged: number;
  flaggedPosts: Post[];          // includes author
  flaggedComments: Comment[];    // includes user
  flaggedTheses: Thesis[];       // includes uploader
  messageReports: MessageReport[];
}
```

`MessageReport`:

```ts
{
  id: string;
  message_id: string;
  reason: string | null;
  status: "open" | "reviewed" | "dismissed";
  created_at: string;
  message_body: string | null;
  sender_id: string;
  conversation_id: string;
  message_created_at: string;
  sender: { id; username; full_name; avatar_url; department_id; department_name } | null;
  reporter: { id; username; full_name } | null;
}
```

Moderation action rules:

- `action`: `"approve"` or `"restore"` → restore; `"hide"` → hide; `"delete"` → permanent delete.
- `reason`: required, trimmed, **3–500 characters**, for every action (including restore).
- Permanent delete is **superadmin-only**; an admin attempting it gets `403`.
- Department admins can only act on content authored by their own department.
- These bodies are **not** Zod-validated; extra keys are ignored.

### 6.7 Conversations and messages

All routes are signed-in. A non-participant always gets `404`.

| Route | Query / body | Returns |
| --- | --- | --- |
| `GET /api/conversations` | `limit` | `Conversation[]` (active threads, newest activity first) |
| `GET /api/conversations/requests` | `limit` | `{ received: Conversation[], sent: Conversation[] }` |
| `GET /api/conversations/unread-count` | — | `{ unread: number }` (all unread messages addressed to the caller, inbox + requests) |
| `POST /api/conversations` | `{ peer_id: uuid }` | `201 Conversation` (status may be `active` or `requested`) |
| `POST /api/conversations/:id/accept` | — | `Conversation`; addressee only, otherwise `404` |
| `GET /api/conversations/:id/messages` | `limit` (1–100), `since_seq?`, `before_seq?` or `cursor?` | `Message[]` ascending by `seq` |
| `POST /api/conversations/:id/messages` | `{ body: "1..4000", client_msg_id: uuid }` | `201 Message`; `200` if the same `client_msg_id` was already stored |
| `POST /api/conversations/:id/read` | `{ upto_seq: number >= 0 }` | `{ updated: [{ id, seq }], last_read_seq }` |
| `POST /api/conversations/:id/mute` | `{ mute_minutes: number 1..525600 \| null }` | `conversation_state` row |

Notes:

- `POST /conversations` returns `400 { error: "You can't message yourself" }`, `404` for an unknown peer, and `403` generic block/policy for a blocked pair.
- Message requests: the recipient sees them in `received`; only the recipient can accept. While `requested`, the requester can send and the recipient can reply; the recipient's first reply implicitly accepts and flips the thread to `active`.
- `MESSAGE_REQUEST_MAX` (server env, default `0` = unlimited) can cap pre-accept sends. Hitting it returns `429 You've reached the message request limit for this person. They need to reply before you can send more.` — this is not the per-minute rate limit.
- `client_msg_id` is the idempotency key. Generate a UUID per draft and reuse it on retry; the server dedupes.
- `seq` is the ordering key; never sort by `created_at`.
- `GET .../messages` returns a bare array in ascending order in both modes. For catch-up after reconnect, pass `since_seq = last known seq`.
- `read` marks every unread message with `seq <= upto_seq` as read, updates `conversation_state.last_read_seq`, and marks related notifications read. `updated` is an array of `{ id, seq }` (the frontend type saying `number` is stale; the UI currently ignores the field).
- Mute suppresses push only; the thread stays in the inbox. `null` clears the mute.
- `GET /conversations/unread-count` is a cheap badge endpoint; it counts every unread message addressed to the caller, including `requested` threads. Summing `conversation.unread` from the active inbox is not equivalent.
- There is no route to delete a message, edit a message, archive a thread, or mark a thread unread.

### 6.8 Message actions

| Route | Who | Body | Returns |
| --- | --- | --- | --- |
| `POST /api/messages/:id/delivered` | recipient only | — | `Message`; `404` otherwise |
| `POST /api/messages/:id/report` | participant of the thread | `{ reason?: "string <= 500" }` | `201` report row; `404` for non-participants |

Reporting is idempotent per `(message, reporter)`: a repeat returns the existing/no-op report instead of creating a duplicate.

### 6.9 Friends

All routes are signed-in.

| Route | Query / body | Returns |
| --- | --- | --- |
| `GET /api/friends` | `limit` | `Friend[]` sorted by peer name |
| `GET /api/friends/requests` | `limit` | `FriendRequests` (`{ incoming, outgoing }`) |
| `POST /api/friends/requests` | `{ addressee_id: uuid }` | `201` friendship row; `400` self; `403` blocked; `409` already pending/accepted |
| `POST /api/friends/requests/:id/accept` | — | friendship row; addressee only |
| `POST /api/friends/requests/:id/decline` | — | friendship row; addressee only |
| `DELETE /api/friends/:userId` | — | `{ message, friendship }` |

Notes:

- An accepted friendship bypasses the recipient's message policy (messages start `active` instead of `requested`).
- A previously declined request can be re-opened by sending a new request.
- There is no friend-suggestion or mutual-friend route.

### 6.10 Admin catalog (departments and courses)

Requires `admin` or `superadmin`. All routes live under `/api/admin`.

| Route | Body / query | Returns |
| --- | --- | --- |
| `GET /api/admin/departments` | — | `Department[]`, including inactive |
| `POST /api/admin/departments` | `{ name, code?, sort_order? }` | `201 Department`; `409` duplicate |
| `PUT /api/admin/departments/:id` | partial same body | `Department`; `404` |
| `POST /api/admin/departments/:id/activate` | — | `Department`; `404` |
| `POST /api/admin/departments/:id/deactivate` | — | `Department`; `404` |
| `GET /api/admin/courses` | `department_id?` | `Course[]`, including inactive |
| `POST /api/admin/courses` | `{ department_id, name, code?, sort_order? }` | `201 Course`; `400` unknown department; `409` duplicate |
| `PUT /api/admin/courses/:id` | partial same body | `Course`; `404` |
| `POST /api/admin/courses/:id/activate` | — | `Course`; `404` |
| `POST /api/admin/courses/:id/deactivate` | — | `Course`; `404` |

Validation: `name` 1–200 chars; `code` ≤20; `sort_order` integer 0–100000. Deactivation is soft: rows remain visible to admins but disappear from `/public/*` pickers. Deactivating a department does not cascade to its courses.

### 6.11 Admin console

Requires `admin` or `superadmin` (exceptions marked **superadmin**). All routes live under `/api/admin`.

| Route | Query / body | Returns |
| --- | --- | --- |
| `GET /api/admin/overview` | — | `AdminOverview` |
| `GET /api/admin/users` | `q`, `role`, `department_id`, `status=active\|suspended`, `limit`, `cursor` | `{ items: AdminUser[], total, next_cursor }` |
| `GET /api/admin/users/:id` | — | dossier: `AdminUser & { email, counts, recent_content, sanctions }`; `404` |
| `PATCH /api/admin/users/:id/role` | `{ role, reason }` | `{ message, user }`; `400` unknown role |
| `POST /api/admin/users/:id/suspend` | `{ reason, until?: ISO \| null }` | `{ message, user }` |
| `POST /api/admin/users/:id/unsuspend` | `{ reason }` | `{ message, user }` |
| `POST /api/admin/users/:id/force-signout` | `{ reason }` | `{ message, sessions_revoked, refresh_tokens_revoked }` — **superadmin** |
| `DELETE /api/admin/users/:id` | `{ reason }` | `{ message, id }` — **superadmin** |
| `GET /api/admin/content` | `type=all\|post\|comment\|thesis`, `status=all\|approved\|flagged\|hidden`, `q`, `department_id`, `author_id`, `limit`, `cursor` | `{ items: AdminContentItem[], total, next_cursor }` |
| `GET /api/admin/audit` | `actor_id`, `action`, `target_type`, `target_id`, `from`, `to`, `q`, `limit`, `cursor` | `{ items: AuditEntry[], total, next_cursor }` — **superadmin** |
| `GET /api/admin/announcements/audience-count` | `type=all\|role\|department`, plus `role?` or `department_id?` | `{ count }` |
| `POST /api/admin/announcements` | `{ title, body, audience }` | `201 { id, recipients }` |
| `GET /api/admin/announcements` | `limit`, `cursor` | `{ items: Announcement[], total, next_cursor }` |

`AdminOverview`:

```ts
{
  users: {
    total: number; students: number; faculty: number;
    department_admins: number; admins: number; superadmins: number;
    suspended: number; active_7d: number; new_7d: number;
  };
  content: { posts: number; theses: number; comments: number; hidden: number; flagged: number };
  reports: { message_reports: number; flagged_posts: number; flagged_comments: number; flagged_theses: number };
  announcements: { sent_30d: number; recipients_30d: number };
  needs_attention: { kind: string; id: string; label: string; author: string | null; created_at: string }[];
  recent_actions: AuditEntry[];   // superadmin only; [] for admin
  generated_at: string;
}
```

Admin action rules:

- `PATCH role`: cannot target yourself; admin cannot grant `admin`/`superadmin`; rank must be strictly higher than the target.
- Suspend/unsuspend/force-signout/delete: cannot target yourself; same rank rule.
- Suspension revokes the target's sessions. `until` omitted/`null` means indefinite.
- Delete removes the Supabase Auth user and the profile. Destructive — confirm in the UI.
- `reason` is required (3–500 chars) for role, suspend, unsuspend, force-signout, and delete.
- `audience` for announcements is a discriminated union:

```json
{ "type": "all" }
{ "type": "role", "role": "student" }
{ "type": "department", "department_id": "<uuid>" }
```

`title` 3–120 chars, `body` 3–2000 chars. Sending with zero matching recipients returns `400`. Announcements are delivered as notifications only; there is no update/delete/resend route.

---

## 7. Screen → endpoint matrix

This covers every screen currently in `frontend/app`. “Guest” means the public rewrite described in §2.5.

| Screen | Audience | API calls | Notes |
| --- | --- | --- | --- |
| `app/_layout.tsx` (root providers/guard) | all | none | Auth/Theme/Presence providers; registers push and push-tap deep links for signed-in non-guests; route guard |
| `app/index.tsx` (splash) | all | none | Redirects based on `AuthContext` session after 1.8 s |
| `(auth)/_layout.tsx` | logged out | none | Auth stack |
| `(auth)/login.tsx` | logged out | Supabase `signInWithPassword` | No API call until a session exists |
| `(auth)/register.tsx` | logged out | Supabase `signUp`, then `POST /users` | Profile creation is best-effort after sign-up |
| `complete-profile.tsx` | signed-in, incomplete profile | `GET /public/departments`, `GET /public/departments/:id/courses`, `PUT /users/:id` | Department + course are required; one-time claim |
| `edit-profile.tsx` | signed-in | Storage upload → `PUT /users/:id` | Avatar goes to bucket `assets`; sends name/bio/year/skills/avatar |
| `suspended.tsx` | suspended | none | Renders `AuthContext.profile` suspension fields; sign-out only |
| `(tabs)/_layout.tsx` | signed-in/guest | none | Tab bar; hides Create for guests; shows “Admin Console” on desktop web for admins |
| `(tabs)/index.tsx` (home) | all | `GET /public/peers`, `GET /posts`, `GET /theses`, `GET /conversations/unread-count` | Guest calls are rewritten to `/public/*`; authenticated calls stay private. The unread call runs only for signed-in users and feeds the header/sidebar Messages badge |
| `(tabs)/search.tsx` | all | `GET /theses?q=&category=` | Server-side, debounced 300 ms; category `All` omits the filter. First 100 results |
| `(tabs)/profile.tsx` | signed-in | `GET /posts?author_id=&limit=100&cursor=` | Server-side author filter; “Load more” fetches the next page with the `created_at\|id` cursor |
| `(tabs)/notifications.tsx` | signed-in | `GET /moderation/notifications`, `PUT /moderation/notifications/:id/read`, `POST /moderation/notifications/read-all` | Handles both array and `{ unread, notifications }` |
| `create.tsx` | signed-in | `POST /posts/preview`, Storage upload → `POST /posts` / `PUT /posts/:id` | Edit mode uses `postId` param and `PUT` |
| `post/[id].tsx` | signed-in for writes; public read possible | `GET /posts/:id`, `GET /posts/:id/comments`, `POST /posts/:id/like`, `POST /posts/:id/comments`, `PUT/DELETE /posts/:id/comments/:commentId`, `DELETE /posts/:id` | Comment edit/delete shown only for own comments; post delete for author |
| `upload-thesis.tsx` | signed-in | `GET /theses/:id`, Storage upload → `POST /theses` / `PUT /theses/:id` | PDF only; edit mode keeps the existing file if unchanged |
| `settings.tsx` | signed-in | `GET/PUT /users/me/message-policy`, `GET /users/me/blocks`, `DELETE /users/:id/block`, `POST /users/me/presence`, `GET /public/departments` | Theme is local-only; presence mode is persisted |
| `friends.tsx` | signed-in | `GET /friends`, `GET /friends/requests`, `POST /friends/requests/:id/accept\|decline`, `DELETE /friends/:userId`, `POST /conversations` | “Message” opens/creates a thread |
| `messages/index.tsx` | signed-in | `GET /conversations`, `GET /conversations/requests`, `POST /conversations/:id/accept` | Each conversation has `unread`; the home header/sidebar consumes `GET /conversations/unread-count` |
| `messages/[id].tsx` | signed-in | `GET /conversations/:id/messages`, `POST /conversations/:id/messages`, `POST /conversations/:id/read`, `POST /messages/:id/delivered`, `POST /messages/:id/report`, `POST /conversations/:id/accept`, `POST/DELETE /users/:id/block`, `GET /users/me/blocks` | Realtime via `useConversationRealtime`; optimistic outbox |
| `(admin)/_layout.tsx` | admin/superadmin | none | Cosmetic role gate; preview mode is local |
| `(admin)/index.tsx` (dashboard) | admin/superadmin | `GET /admin/overview` | `recent_actions` empty for non-superadmin |
| `(admin)/users/index.tsx` | admin/superadmin | `GET /admin/users` | Filters: search, role, department, status |
| `(admin)/users/[id].tsx` | admin/superadmin | `GET /admin/users/:id`, `PATCH /admin/users/:id/role`, `POST .../suspend`, `POST .../unsuspend`, `POST .../force-signout`, `DELETE /admin/users/:id` | Force-signout/delete visible only to superadmin |
| `(admin)/content.tsx` | admin/superadmin | `GET /admin/content`, `GET /moderation/queue`, `POST /moderation/posts/:id`, `POST /moderation/comments/:id`, `POST /moderation/theses/:id`, `POST /moderation/message-reports/:id` | `admin/content` is admin-only; the queue call also works for admins |
| `(admin)/audit.tsx` | superadmin | `GET /admin/audit` | Server returns `403` for admin |
| `(admin)/announcements.tsx` | admin/superadmin | `GET /admin/announcements`, `GET /admin/announcements/audience-count`, `POST /admin/announcements` | Audience picker: all/role/department |
| `(admin)/departments.tsx` | admin/superadmin | `GET /admin/departments`, `POST /admin/departments`, `PUT /admin/departments/:id`, `POST .../activate\|deactivate`; same for `/admin/courses` | Uses direct `apiJson` calls for catalog |
| `(admin)/settings.tsx` | admin/superadmin | **none** | **Stub**: “Settings form will be implemented here.” There is no settings API. Do not add controls. |
| `(moderation)/_layout.tsx` | departmentAdmin/admin/superadmin | none | Desktop-only role gate; its own sidebar; preview mode is local |
| `(moderation)/index.tsx` | departmentAdmin/admin/superadmin | `GET /moderation/queue`, `POST /moderation/posts/:id`, `POST /moderation/comments/:id`, `POST /moderation/theses/:id`, `POST /moderation/message-reports/:id` | Queue only; restore/hide and report resolution. No admin content library and no permanent delete |

Shared library wrappers used by the screens: `src/lib/api.ts`, `adminApi.ts`, `messages.ts`, `catalog.ts`, `upload.ts`, `realtime.ts`, `push.ts`, `outbox.ts`.

### 7.1 Role coverage notes (read before designing role-specific screens)

| Role | Current UI coverage | Backend reality |
| --- | --- | --- |
| `student` | Full app | Full social/content/messaging capabilities |
| `faculty` | Same screens as student | **No faculty-only endpoint exists.** Adviser/review/approval capabilities are not implemented; do not invent them |
| `departmentAdmin` | Moderation console (`(moderation)`) | Backend supports the department-scoped moderation queue and actions; `(admin)` remains `admin`/`superadmin`-only |
| `admin` | Admin console | Users, content, catalog, announcements, overview; no audit/force-signout/delete |
| `superadmin` | Admin console | Everything, including audit, force sign-out, account deletion, role grants |
| `guest` | Public feed via `/public/*` | No writes, no realtime, no push |

Three product-level implications:

- **The admin console is desktop-web only.** `(admin)/_layout.tsx` requires `Platform.OS === "web" && width >= 768`; mobile admins are redirected to the normal tabs. Do not design a phone admin panel without an explicit product decision.
- **Thesis approval workflow does not exist.** `POST /theses` auto-approves and the AI scan may flag asynchronously. There is no “faculty approves thesis”, “revision requested”, or “defense schedule” API. Do not design those controls unless the backend adds them.
- **The moderation console is also desktop-web only.** `(moderation)/_layout.tsx` requires `Platform.OS === "web" && width >= 768`; mobile moderators are redirected to the normal tabs. It uses only the queue and moderation-action routes; do not add the admin content library, user administration, or permanent delete to it.

---

## 8. Realtime contract

Realtime is **Supabase Realtime on the client**, authorized by the user's Supabase session. The API server is not in the realtime path.

| Channel | Type | Purpose | Payload |
| --- | --- | --- | --- |
| `db:<user_id>` | Postgres Changes | `messages`, `conversations`, `notifications` rows for the signed-in user | `{ action: "INSERT" \| "UPDATE" \| "DELETE", message/conversation/notification, previous? }` |
| `presence:campus` | Private presence | Campus presence map | `{ user_id, mode, online_at }` keyed by `user_id` |
| `conv:<conversation_id>` | Private broadcast | Typing indicator | `{ user_id, typing: boolean }` |

Rules:

- Subscribe only after a Supabase session exists; guests and signed-out users do not connect.
- Clean up channels on unmount/sign-out. The existing `PresenceContext` owns the session-scoped lifecycle.
- Postgres Changes events are **hints**, not the source of truth. Merge by id/seq and ignore duplicates.
- On reconnect, fetch `GET /conversations/:id/messages?since_seq=<lastSeq>` before resuming live updates.
- Typing state is ephemeral: send `typing: true`, then `typing: false` after the idle timeout. Never persist it.
- Delivery/read receipts are `UPDATE` events on `messages` (`delivered_at`, `read_at`), backed by the two POST routes in §6.8.
- RLS policies restrict each row to its participant. The client must still handle an empty/denied subscription as “offline”, not as an error screen.

| Presence mode | Meaning |
| --- | --- |
| `online` | Available and visible in the presence map |
| `away` | Idle/AFK |
| `busy` | Busy but visible |
| `dnd` | Do not disturb (broadcasts push only where allowed) |
| `invisible` | Connected but not tracked/shown |

---

## 9. Storage contract

Uploads go **directly from the client to Supabase Storage**, then the public URL is sent to the API.

| Bucket | Public read | Allowed content | Max size | Write access |
| --- | --- | --- | --- | --- |
| `assets` | yes | `image/png`, `image/jpeg`, `image/webp` | 10 MB | authenticated; owner update/delete |
| `theses` | yes | `application/pdf` | 10 MB | authenticated; owner update/delete |

Path conventions used by the current app:

- Avatar: `avatars/<user_id>-<timestamp>.jpg`
- Post image: `posts/<user_id>-<timestamp>.jpg`
- Thesis PDF: `theses/<user_id>/<timestamp>.<ext>`

The backend validates that `avatar_url`, `image_url`, and `pdf_url` point inside this project's Storage. External URLs are rejected with `400`.

Deleting a post/thesis row does **not** delete its uploaded file; there is no storage-cleanup API. Do not present “delete” as guaranteed file erasure.

---

## 10. Existing frontend audit (2026-10-20)

What the current UI already does correctly:

- List/detail screens call real API routes; no mock rows were found in feed/search screens.
- The profile, home sidebar, and settings sidebar no longer fall back to hardcoded identity/location data (fixed 2026-10-21).
- Repository search, profile posts, and the peer picker use server-side filters (fixed 2026-10-21). Profile posts load one page at a time; the peer picker debounces `q`.
- The home Messages badge uses `GET /conversations/unread-count` for signed-in users (fixed 2026-10-21).
- Department admins have a desktop moderation console wired to the queue/action routes (fixed 2026-10-21).
- Admin screens are wired to `adminApi.ts`; departments/courses use the real catalog routes.
- Messaging uses the real outbox, idempotency keys, receipts, and realtime catch-up.
- Settings theme is intentionally local; message policy, presence, and blocks are persisted.
- `notifications.tsx` tolerates both the current object response and a legacy array.

Findings and edge cases the UI must account for:

| Severity | Finding | Action |
| --- | --- | --- |
| Fixed | `(admin)/settings.tsx` was a stub with no settings endpoint, but the admin nav still advertised it. | Nav link removed; the route now explains that no API exists. `API-REQ-001` remains Open. |
| Fixed | `departmentAdmin` had backend moderation access but no UI: `(admin)/_layout.tsx` rejects non-admin ranks. | `(moderation)` console built with only the queue/action routes; restore/hide content and resolve message reports, department-scoped, desktop-only. `(admin)` stays admin-only. |
| Gap | `faculty` has no role-specific API capability; adviser/review/approval screens have no backend support. | Do not invent them; log a request if product needs an approval workflow. |
| Fixed | `listBlocked()` typed rows as `{ id, blocked_id, created_at }[]`, but the API returns `{ blocked_id, created_at, peer }` with **no `id`**. `settings.tsx` used `row.id` as the list key, so it was `undefined`. | Type now uses `blocked_id`; the list keys by `blocked_id`. |
| Fixed | `markRead()` was typed `{ updated: number }`, but the API returns `{ updated: {id,seq}[], last_read_seq }`. | Type now matches the response. |
| Fixed | Profile, home sidebar, and settings sidebar fell back to a hardcoded “Mark Antipo” identity; profile also hardcoded “Bacolod City” / “Joined Aug 2023” for every account. | Fallbacks and fabricated fields removed; profile shows loading/error/retry, and the sidebars use the real profile or a neutral guest/user label. |
| Fixed | Profile “my posts” fetched `GET /posts` and filtered client-side, so only the first ≤100 rows were covered. | Now calls `GET /posts?author_id=` and uses a “Load more” button with the `created_at\|id` cursor. |
| Fixed | Repository search filtered `GET /theses` client-side, so only the first page was searchable. | Now calls `GET /theses?q=&category=`; input is debounced 300 ms and the server matches title, abstract, uploader, and department. |
| Fixed | Search category logic treated `"Graduate Dissertation"` as including `"Capstone"`. | Graduate filter is exact; legacy `Capstone` maps only to the undergraduate filter. The server applies the same rule. |
| Fixed | No exact unread badge across inbox and requests. | `GET /conversations/unread-count` returns the total; the home header (mobile) and sidebar (desktop) render it for signed-in users. |
| UX risk | Non-admin department/course changes after onboarding return `200` but are ignored. | Render catalog fields read-only after onboarding. |
| UX risk | Create/update responses for posts/comments/theses are raw rows (no `author`/`uploader`, no counts). | Refetch or merge before rendering. |
| UX risk | `admin` cannot manage peer `admin`/`superadmin`; UI may show actions that 403. | Hide/disable by rank, and surface the server message. |
| Fixed | Guest `/users/:id` rewrite was broken (mapped to a nonexistent `/public/peers/:id`). | `/users...` is no longer rewritten; guest code uses `/public/*` explicitly. |
| Expected | Non-participants get `404` for conversations. | Show “not found”, not “forbidden”. |
| Expected | Suspended users get `403` on everything except their own profile. | Route to `suspended.tsx` on `code: "account_suspended"`. |
| Expected | Rate limits can return `429` with no `Retry-After` handling in the client. | Show a clear retry message; do not auto-loop. |

---

## 11. Known gaps (blocked UI capabilities)

Every capability below is either missing an endpoint or missing a required filter. A UI that needs it must show a disabled control and add a row to `docs/API-REQUESTS.md`.

| # | Missing capability | Impact |
| --- | --- | --- |
| 1 | Admin/system settings (site name, maintenance mode, feature flags, limits) | `(admin)/settings.tsx` cannot be implemented |
| 2 | Bookmarks/saved items | No save/list-saved route |
| 3 | User reports for posts/comments/theses | Only messages can be reported; moderation relies on the AI scan and admin action |
| 4 | Edit/delete/resend announcements | Announcement history is read-only |
| 5 | Message edit/delete, conversation archive/delete/unread | Only mute and read exist |
| 6 | Group conversations | 1:1 only |
| 7 | Notification preferences beyond message policy/presence | No email/digest/push-category settings |
| 8 | Friend suggestions / mutual friends | Only existing friends/requests |
| 9 | Staff directory role filter (non-admin) | `/public/peers` now supports name/department/year; `role` is not exposed |
| 10 | Bulk admin actions / CSV export | One row per request |
| 11 | Storage file cleanup or media library | Deleting a row does not delete the file |
| 12 | Thesis download counter/analytics | No counter route |
| 13 | Push-token listing for the current user | Only add/remove by token value |
| 14 | Faculty adviser review / thesis approval workflow | `faculty` has no role-specific endpoint; theses auto-approve on upload |

---

## 12. Changing this contract

1. Backend changes land first (maintainer only).
2. Run `node backend/scripts/list-routes.js` and reconcile the route count/list.
3. Update this document in the same PR as the backend change.
4. Update `docs/API-REQUESTS.md`: move fulfilled requests to **Done**, with the route added.
5. Never let a UI PR invent a route “temporarily”. Temporary contracts become permanent bugs.

---

## 13. Quick verification checklist for a UI PR

- [ ] Every new control calls a route listed in §6 (or is visibly disabled with a reason).
- [ ] No direct Supabase table queries; only Auth, Storage, and Realtime from §8–9.
- [ ] Loading, empty, error, offline, unauthorized, and suspended states exist.
- [ ] `error ?? message` is used for API errors; validation `fields` are surfaced on forms.
- [ ] Pagination uses the documented cursor and does not assume a total.
- [ ] Mutations handle raw-row responses (merge/refetch).
- [ ] Role-based hiding is cosmetic; server errors are still handled.
- [ ] Realtime subscriptions are cleaned up; reconnect uses `since_seq`.
- [ ] Uploads respect bucket, MIME type, and 10 MB limits.
- [ ] `npx tsc --noEmit` and `npx expo lint` pass.
