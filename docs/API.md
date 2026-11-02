# LCCB Connect — API Reference

> **Base URL:** `http://localhost:3000/api` (dev) · set `EXPO_PUBLIC_API_URL` for production  
> **Frontend HTTP client:** Axios (`frontend/src/lib/api.ts`) — attaches auth token automatically via request interceptor.

---

## Authentication

Every protected route requires a Supabase access token in the `Authorization` header:

```
Authorization: Bearer <supabase_access_token>
```

The server **derives identity from the verified JWT only** — never from the request body.

### Roles (lowest → highest privilege)

| Role | Key | Description |
|---|---|---|
| `student` | `student` | Default for new accounts |
| `faculty` | `faculty` | Academic adviser / reviewer |
| `departmentAdmin` | `departmentAdmin` | Head of a department |
| `admin` | `admin` | Institution administrator |
| `superadmin` | `superadmin` | System-wide owner (all access) |

### Standard error shape

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|---|---|
| `401` | Missing or invalid Bearer token |
| `403` | Authenticated but insufficient role, or account suspended |
| `404` | Resource not found |
| `409` | Conflict (duplicate, already exists) |
| `422` | Validation failed |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

### Rate limits (global, per-IP)

| Limiter | Window | Limit |
|---|---|---|
| All `/api/*` | 60 s | 120 req |
| Write methods (POST/PUT/PATCH/DELETE) | 60 s | 30 req |

---

## Public Endpoints

> No `Authorization` header required. Guest-mode GETs to `/posts` and `/theses` are automatically forwarded here by the frontend interceptor.

### `GET /api/public/posts`
List published posts (paginated).

**Query params:** `limit`, `offset`, `type`, `author_id`

**Response `200`**
```json
[{ "id": 1, "type": "project", "title": "...", "content": "...", "author": {...}, "likes": 0, "comments": 0 }]
```

---

### `GET /api/public/posts/:id`
Get a single published post.

---

### `GET /api/public/posts/:id/comments`
List comments for a published post.

---

### `GET /api/public/theses`
List published theses.

**Query params:** `limit`, `offset`, `category`

---

### `GET /api/public/theses/:id`
Get a single published thesis.

---

### `GET /api/public/peers`
List all active user profiles (public directory).

---

### `GET /api/public/departments`
List active departments (used in the pre-login registration form).

---

### `GET /api/public/departments/:id/courses`
List active courses for a department.

---

## Users

> Auth: `requireAuth` · `loadProfile` · `requireActiveAccount`

### `GET /api/users`
List all users.

**Response `200`** — array of profile objects.

---

### `GET /api/users/:id`
Get a single user profile.

> **Special case:** A suspended account may still call this for its own `id` to display the suspension reason.

**Response `200`**
```json
{
  "id": "uuid",
  "username": "mark_19",
  "full_name": "Mark Santos",
  "avatar_url": "assets/avatars/...",
  "bio": "...",
  "role": "student",
  "course": "BSCS",
  "year_level": "3",
  "department_id": "uuid",
  "course_id": "uuid",
  "skills": ["React", "Node"],
  "message_policy": "everyone",
  "presence_mode": "online",
  "suspended_at": null,
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

### `POST /api/users`
Create the caller's own profile (self-provisioning on first login).

**Body**
```json
{ "username": "mark_19", "full_name": "Mark Santos" }
```

**Response `201`** — created profile object.

---

### `PUT /api/users/:id`
Update a profile. Caller must own the profile or be an admin.

**Body** (all optional)
```json
{
  "username": "new_handle",
  "full_name": "New Name",
  "bio": "...",
  "avatar_url": "assets/avatars/...",
  "course_id": "uuid",
  "year_level": "4",
  "skills": ["TypeScript"]
}
```

---

### `DELETE /api/users/:id`
Delete a user. Caller must own the account or be a superadmin.

---

## Posts

> Auth: `requireAuth` · `loadProfile` · `requireActiveAccount`

### `GET /api/posts`
List posts for the authenticated feed.

**Query params:** `limit`, `offset`, `type`, `author_id`

---

### `GET /api/posts/:id`
Get a single post.

---

### `POST /api/posts`
Create a post.

**Body**
```json
{
  "type": "project",
  "content": "Body text",
  "title": "Optional title",
  "technologies": ["React Native", "Node.js"],
  "github_url": "https://github.com/...",
  "image_url": "assets/posts/...",
  "preview_metadata": { "url": "...", "title": "...", "description": "...", "image": "..." }
}
```

**Response `201`** — created post object.

---

### `PUT /api/posts/:id`
Update a post. Owner only.

**Body** — same fields as POST (all optional).

---

### `DELETE /api/posts/:id`
Delete a post. Owner or admin.

---

### `POST /api/posts/:id/like`
Toggle like on a post (like if not liked, unlike if already liked).

**Response `200`** `{ "liked": true, "likes": 42 }`

---

### `GET /api/posts/:id/comments`
List comments for a post.

---

### `POST /api/posts/:id/comments`
Add a comment.

**Body** `{ "content": "Great work!" }`

**Response `201`** — created comment object.

---

### `PUT /api/posts/:id/comments/:commentId`
Edit a comment. Owner only (enforced in SQL).

**Body** `{ "content": "Updated text" }`

---

### `DELETE /api/posts/:id/comments/:commentId`
Delete a comment. Owner or admin.

---

### `POST /api/posts/preview`
Generate link-preview metadata for a URL.

**Body** `{ "url": "https://..." }`

**Response `200`** `{ "title": "...", "description": "...", "image": "..." }`

---

## Theses

> Auth: `requireAuth` · `loadProfile` · `requireActiveAccount`

### `GET /api/theses`
List theses.

**Query params:** `limit`, `offset`, `category`

---

### `GET /api/theses/:id`
Get a single thesis.

---

### `POST /api/theses`
Submit a thesis manuscript.

**Body**
```json
{
  "title": "Thesis Title",
  "abstract": "...",
  "category": "capstone",
  "pdf_url": "theses/doc-id.pdf"
}
```

**Response `201`** — created thesis object.

---

### `PUT /api/theses/:id`
Update a thesis. Owner only.

**Body** — same fields as POST (all optional).

---

### `DELETE /api/theses/:id`
Delete a thesis. Owner or admin.

---

## Conversations & Messages

> Auth: `requireAuth` · `loadProfile` · `requireActiveAccount`  
> Extra rate limits: send limiter per conversation, daily limiter per user.

### `GET /api/conversations`
List the caller's conversations (active + pending), ordered by last message.

**Query params:** `limit`

**Response `200`** — array of `Conversation` objects.

---

### `GET /api/conversations/requests`
List incoming message requests (status = `requested`).

**Query params:** `limit`

---

### `GET /api/conversations/unread-count`
Total unread message count across all active conversations.

**Response `200`** `{ "count": 5 }`

---

### `POST /api/conversations`
Open (or re-open) a 1:1 conversation with a peer. If the peer's policy doesn't permit the caller, returns a `requested` conversation.

**Body** `{ "peer_id": "uuid" }`

**Response `201`** — `Conversation` object.

---

### `POST /api/conversations/:id/accept`
Accept a pending message request. Addressee only.

**Response `200`** — updated `Conversation`.

---

### `GET /api/conversations/:id/messages`
List messages in a conversation.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `limit` | number | Page size |
| `since_seq` | number | Catch-up: all messages with `seq > since_seq` |
| `before_seq` | number | Backward pagination: messages before this seq |

**Response `200`** — array of `Message` objects.

---

### `POST /api/conversations/:id/messages`
Send a message. Idempotent on `(sender_id, client_msg_id)` — a retry can never double-insert.

**Body**
```json
{ "body": "Hello!", "client_msg_id": "uuid-v4" }
```

**Response `201`** — `Message` object.

---

### `POST /api/conversations/:id/read`
Mark messages up to `upto_seq` as read.

**Body** `{ "upto_seq": 42 }`

**Response `200`** `{ "updated": [...], "last_read_seq": 42 }`

---

### `POST /api/conversations/:id/mute`
Mute a conversation for `mute_minutes`. Pass `null` to unmute.

**Body** `{ "mute_minutes": 60 }` or `{ "mute_minutes": null }`

---

### `POST /api/messages/:id/delivered`
Mark a message as delivered. Recipient only.

---

### `POST /api/messages/:id/report`
Report a message.

**Body** `{ "reason": "Optional reason" }`

---

## Friends

> Auth: `requireAuth` · `loadProfile` · `requireActiveAccount`

### `GET /api/friends`
List the caller's accepted friends.

**Query params:** `limit`

---

### `GET /api/friends/requests`
List incoming and outgoing friend requests.

---

### `POST /api/friends/requests`
Send a friend request.

**Body** `{ "addressee_id": "uuid" }`

---

### `POST /api/friends/requests/:id/accept`
Accept a friend request.

---

### `POST /api/friends/requests/:id/decline`
Decline a friend request.

---

### `DELETE /api/friends/:userId`
Remove a friend (unfriend).

---

## Social — Presence, Policy, Blocks, Devices

> Auth: `requireAuth` · `requireActiveAccount` — mounted at `/api/users`

### `GET /api/users/me/message-policy`
Get the caller's "who can message me" policy.

**Response `200`**
```json
{ "message_policy": "everyone", "department_ids": [] }
```

---

### `PUT /api/users/me/message-policy`
Update the message policy.

**Body**
```json
{ "message_policy": "friends" }
// or for selected departments:
{ "message_policy": "selected", "department_ids": ["uuid1", "uuid2"] }
```

Valid values: `"everyone"` · `"friends"` · `"selected"` · `"nobody"`

---

### `POST /api/users/me/presence`
Set online presence mode.

**Body** `{ "mode": "online" }` — values: `"online"` · `"away"` · `"invisible"`

---

### `POST /api/users/me/heartbeat`
Heartbeat to maintain online status and last-seen timestamp.

**Body** (all optional)
```json
{ "mode": "online", "last_seen_visible": true }
```

---

### `POST /api/users/me/device-tokens`
Register a push notification token.

**Body** `{ "token": "ExponentPushToken[...]", "platform": "ios" }`

Platform values: `"ios"` · `"android"` · `"web"`

---

### `DELETE /api/users/me/device-tokens`
Unregister a push token (e.g. on sign-out).

**Body** `{ "token": "ExponentPushToken[...]" }`

---

### `GET /api/users/me/blocks`
List users the caller has blocked.

---

### `POST /api/users/:id/block`
Block a user.

---

### `DELETE /api/users/:id/block`
Unblock a user.

---

## Moderation

> Auth: `requireAuth` · `loadProfile` · `requireActiveAccount`

### Notifications (all authenticated users)

#### `GET /api/moderation/notifications`
Get the caller's in-app notifications.

#### `PUT /api/moderation/notifications/:id/read`
Mark a notification as read.

#### `POST /api/moderation/notifications/read-all`
Mark all notifications as read.

---

### Moderation Queue (role: `departmentAdmin` and above)

#### `GET /api/moderation/queue`
Get flagged/reported content awaiting review.

#### `POST /api/moderation/posts/:id`
Moderate a post.

**Body** `{ "action": "hide", "reason": "Violates policy" }`

Actions: `"hide"` · `"restore"` · `"delete"`

#### `POST /api/moderation/comments/:id`
Moderate a comment. Same body as above.

#### `POST /api/moderation/theses/:id`
Moderate a thesis. Same body as above.

#### `POST /api/moderation/message-reports/:id`
Resolve a message report.

**Body** `{ "action": "reviewed", "reason": "..." }`

Actions: `"reviewed"` · `"dismissed"`

---

## Admin

> Auth: `requireAuth` · `loadProfile` · `requireActiveAccount` · role: `admin` or `superadmin`

### `GET /api/admin/overview`
Dashboard summary — user counts, content counts, flagged items, recent audit actions.

---

### `GET /api/admin/users`
Paginated user list with filtering.

**Query params:** `q`, `role`, `department_id`, `status` (`active`/`suspended`), `limit`, `cursor`

---

### `GET /api/admin/users/:id`
Full user dossier — profile + email + content counts + recent posts + sanctions history.

---

### `PATCH /api/admin/users/:id/role`
Change a user's role. Caller must outrank the target.

**Body** `{ "role": "faculty", "reason": "Promoted to faculty adviser" }`

---

### `POST /api/admin/users/:id/suspend`
Suspend a user account.

**Body**
```json
{ "reason": "Repeated violations", "until": "2026-12-01T00:00:00Z" }
```
`until` is optional — omit for indefinite suspension.

---

### `POST /api/admin/users/:id/unsuspend`
Lift a suspension.

**Body** `{ "reason": "Served suspension" }`

---

### `POST /api/admin/users/:id/force-signout`
Revoke all active sessions. **Role: `superadmin` only.**

**Body** `{ "reason": "Security incident" }`

---

### `DELETE /api/admin/users/:id`
Permanently delete a user account. **Role: `superadmin` only.**

**Body** `{ "reason": "Account removal request" }`

---

### `GET /api/admin/content`
Paginated content list (posts, comments, theses).

**Query params:** `type` (`post`/`comment`/`thesis`), `status`, `q`, `department_id`, `author_id`, `limit`, `cursor`

---

### `GET /api/admin/audit`
Audit log of admin actions. **Role: `superadmin` only.**

**Query params:** `actor_id`, `action`, `target_type`, `target_id`, `from`, `to`, `q`, `limit`, `cursor`

---

### `GET /api/admin/announcements/audience-count`
Count recipients for a proposed announcement audience before sending.

**Query params:** `type` (`all`/`role`/`department`), `role`, `department_id`

**Response `200`** `{ "count": 142 }`

---

### `POST /api/admin/announcements`
Send a push + in-app announcement.

**Body**
```json
{
  "title": "Semester Reminder",
  "body": "Thesis deadline is Friday.",
  "audience": { "type": "all" }
}
```

Audience options:
- `{ "type": "all" }`
- `{ "type": "role", "role": "faculty" }`
- `{ "type": "department", "department_id": "uuid" }`

**Response `200`** `{ "id": "uuid", "recipients": 87 }`

---

### `GET /api/admin/announcements`
List past announcements (paginated).

**Query params:** `limit`, `cursor`

---

## Admin — Catalog Management

> Auth: `requireAuth` · `loadProfile` · `requireActiveAccount` · role: `admin` or `superadmin`

### Departments

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/departments` | List all departments (including inactive) |
| `POST` | `/api/admin/departments` | Create a department |
| `PUT` | `/api/admin/departments/:id` | Update a department |
| `POST` | `/api/admin/departments/:id/activate` | Make a department active |
| `POST` | `/api/admin/departments/:id/deactivate` | Make a department inactive |

**Create/Update body**
```json
{ "name": "College of Information Technology", "code": "CIT" }
```

---

### Courses

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/courses` | List all courses (including inactive) |
| `POST` | `/api/admin/courses` | Create a course |
| `PUT` | `/api/admin/courses/:id` | Update a course |
| `POST` | `/api/admin/courses/:id/activate` | Make a course active |
| `POST` | `/api/admin/courses/:id/deactivate` | Make a course inactive |

**Create/Update body**
```json
{ "name": "BS Computer Science", "code": "BSCS", "department_id": "uuid" }
```

---

## Frontend Usage Reference

All Express-API calls go through the Axios-backed wrappers in `frontend/src/lib/api.ts`:

```ts
import { apiJson, apiFetch, ApiError } from '../lib/api';

// GET — typed response
const posts = await apiJson<Post[]>('/posts');

// POST with body
const msg = await apiJson<Message>(`/conversations/${id}/messages`, {
  method: 'POST',
  body: JSON.stringify({ body: 'Hello', client_msg_id: uuid }),
});

// Error handling
try {
  await apiJson('/posts/999');
} catch (err) {
  if (err instanceof ApiError) {
    console.log(err.status);  // 404
    console.log(err.message); // "Not found"
  }
}
```

Higher-level wrappers by domain:

| File | Covers |
|---|---|
| `src/lib/api.ts` | Core Axios client, `updatePost`, `deletePost`, `updateThesis`… |
| `src/lib/adminApi.ts` | All `/admin/*` endpoints |
| `src/lib/messages.ts` | Conversations, messages, friends, presence, blocks, device tokens |
