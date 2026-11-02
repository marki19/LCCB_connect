# UI Build Rules — LCCB Connect

> **Paste this file into the UI agent's context before it writes code.**
> It is the short, enforceable version of the backend contract. The full endpoint reference is [`BACKEND_CONTRACT.md`](./BACKEND_CONTRACT.md).

---

## 1. Scope

You are building **frontend UI only**.

**Allowed:**

- `frontend/app/**` — screens, layouts, navigation
- `frontend/src/components/**`, `frontend/src/hooks/**`, `frontend/src/contexts/**`, `frontend/src/lib/**`, `frontend/src/types.ts`
- `frontend/src/theme/**` / tokens, assets, copy
- New UI components and styles

**Not allowed without explicit human approval:**

- `backend/**` (any file, including tests, scripts, schema, migrations, validation)
- `docs/BACKEND_CONTRACT.md` (it mirrors the backend; do not “fix” it to match UI wishes)
- Supabase table/bucket policy changes
- New npm packages with native code (Expo Go cannot run them; this project uses Expo Go)

If a change seems to require backend work, **stop** and log it in `docs/API-REQUESTS.md`.

---

## 2. Source of truth

1. `docs/BACKEND_CONTRACT.md` for endpoints, payloads, roles, errors, realtime, storage.
2. The existing code under `frontend/src/lib/` for client behavior.
3. If the contract and the running API disagree, report it; do not guess and do not patch the backend.

Run this when in doubt about routes:

```bash
cd backend
node scripts/list-routes.js
```

---

## 3. The hard block rule

**Every control that changes state — or displays server data — must call a documented endpoint.**

If there is no endpoint:

1. Do **not** invent a route, fake a response, or use local mock data.
2. Do **not** call Supabase tables directly.
3. Render the control **disabled** with a short reason (e.g. “Not available yet”).
4. Add an entry to `docs/API-REQUESTS.md` using its template.
5. Continue with the rest of the screen.

A screen may ship with visibly unavailable sections. It may not ship with fake sections.

**Known blocked items** (see contract §11): admin settings, “theses by user”, bookmarks, post reports, announcement editing, message edit/delete, group chats, notification preferences, friend suggestions, staff-directory role filter, bulk admin actions, storage cleanup, thesis analytics, faculty adviser/approval workflows.

---

## 4. Use the existing plumbing

Do not create a parallel API layer.

| Concern | Use |
| --- | --- |
| Authenticated fetch | `apiFetch` / `apiJson` from `frontend/src/lib/api.ts` |
| Admin console | `frontend/src/lib/adminApi.ts` |
| Messaging/social | `frontend/src/lib/messages.ts` |
| Catalog | `frontend/src/lib/catalog.ts` |
| Uploads | `frontend/src/lib/upload.ts` |
| Realtime | `frontend/src/lib/realtime.ts` |
| Push | `frontend/src/lib/push.ts` |
| Offline sends | `frontend/src/lib/outbox.ts` |
| Auth/session/profile | `useAuth()` from `AuthContext` |
| Presence | `usePresence()` from `PresenceContext` |
| Theme | `useTheme()` from `ThemeContext` |
| Shared response types | `frontend/src/types.ts` and `adminApi.ts` |

Never attach `Authorization` by hand; `apiFetch` does it. Never store tokens in AsyncStorage or module globals.

---

## 5. Required states for every data surface

Every list/detail/form screen must handle all of these explicitly:

| State | Requirement |
| --- | --- |
| Loading | Skeleton or spinner; no layout jump; do not show “empty” while loading |
| Empty | Real empty copy (“No theses yet”), not a blank screen |
| Error | Human message from `error ?? message`; retry control |
| Offline | Cached/queued behavior where the lib supports it; otherwise a clear banner |
| Unauthorized | `401` → sign out and route to login |
| Suspended | `403` with `code: "account_suspended"` → route to `suspended.tsx` |
| Forbidden | `403` → hide/disable the action; show the server message where useful |
| Not found | `404` → “not found” screen/state; never leak whether a private id exists |
| Rate limited | `429` → “Too many requests; try again shortly.” Never auto-retry in a loop |
| Partial data | Show what loaded; do not blank the screen for one failed panel |

A button must also have: disabled/loading state, double-tap protection, and error recovery.

---

## 6. Auth, roles, and permissions

- Sign-in/sign-up go through Supabase Auth; the API is called only after a session exists.
- Password reset is **not implemented**. If the design needs it, use `supabase.auth.resetPasswordForEmail` plus a configured deep link; do not invent an API route.
- The first profile fetch may `404`; create the profile with `POST /users` (the existing `AuthContext` does this).
- Department + course are required in onboarding. **Non-admins cannot change them later** — render them read-only after onboarding.
- Role checks in the UI are **cosmetic**. The server enforces permissions:
  - `student`/`faculty`: no moderation or admin console. `faculty` has **no extra API capability**; do not invent adviser/review/approval screens.
  - `departmentAdmin`: desktop moderation console (`(moderation)`) scoped to their department. The queue and restore/hide actions are live; the admin content library and permanent delete are not available there.
  - `admin`: moderation + admin console; cannot manage peer `admin`/`superadmin`, cannot permanently delete content.
  - `superadmin`: everything, including audit, force sign-out, account deletion.
- Never let a hidden control’s action run anyway. Never show a destructive action without confirmation.
- The admin console is **desktop-web only** (`Platform.OS === "web"` and width ≥768). Mobile admins are redirected to the normal tabs; do not design a phone admin console.
- Suspended users may read only their own profile. Route them to the suspension screen for every other `403 account_suspended`.
- Guest mode is frontend-only: public reads only, no writes, no realtime, no push. Call `/public/*` explicitly; the `/users/:id` guest rewrite is broken.

---

## 7. Forms and validation

- Mirror the documented body **exactly**. Strict schemas reject unknown keys with `400`.
- Send only keys that exist in the contract; do not send `id`, `role`, `author_id`, `uploader_id`, `sender_id`, or `department` as identity fields.
- Trim strings the way the server does; respect max lengths (contract §6).
- Map `400` validation responses to fields:

```ts
const body = await res.json();
// body = { error: "Validation failed", fields: [{ path, message }] }
```

Show the message next to the matching input when `path` matches; otherwise show it as a form-level error.

- Disable submit while pending. On success, clear/close the form and refresh the affected data.
- Dates: send ISO-8601 with offset where the contract requires it. Parse server timestamps as UTC.
- Destructive actions (delete account, delete post/thesis/comment, permanent moderation delete, force sign-out) require an explicit confirmation dialog naming the object.

---

## 8. Pagination and lists

- Ordinary lists return a **bare array**; admin lists return `{ items, total, next_cursor }`.
- `limit` is 1–100. Defaults differ (100 ordinary, 20 peers, 25 admin).
- Use the documented cursor:
  - posts/theses/admin: `"<created_at>|<id>"`
  - `/users` directory: last id
  - messages: `before_seq` / `since_seq`
- No endpoint returns `has_more` on ordinary lists. A full page *may* have more; do not claim “end of list” until a page is shorter than the limit.
- Do not fetch all pages eagerly. Infinite scroll / “Load more” with a stable key.
- Current server-side lists:
  - Profile “my posts” uses `GET /posts?author_id=` and a “Load more” cursor.
  - Repository search uses `GET /theses?q=&category=` with a 300 ms debounce.
  - The peer picker uses `GET /public/peers?q=` with a 300 ms debounce.
  - The home Messages badge uses `GET /conversations/unread-count` for signed-in users.

---

## 9. Mutations and freshness

- Create/update responses for **posts, comments, theses** are raw rows: no `author`/`uploader`, no counts, no department names.
  - Merge known local values, or refetch the list/detail after success.
- Like is a toggle: `{ liked }` is the new state.
- Friend requests can return `409` when a request already exists; treat it as “already requested”, not a crash.
- Message send is idempotent by `client_msg_id`: reuse the same UUID on retry; a retry may return `200` instead of `201`.
- Conversation create returns `201` even if it reopens an existing thread; accept both `200`/`201`.
- `DELETE /users/:id` is self-only; admins must use the audited admin delete.
- `PUT /users/:id` rejects `role` with `400`; use `PATCH /admin/users/:id/role`.
- Non-admin department/course updates after onboarding return `200` but are ignored. Do not present that as a successful edit.

---

## 10. Realtime, messaging, and presence

- Realtime is Supabase Realtime; start it only when a session exists. Guest/signed-out users do not connect.
- Channels:
  - `db:<user_id>` — messages, conversations, notifications
  - `presence:campus` — campus presence (private)
  - `conv:<id>` — typing (private broadcast)
- Clean up subscriptions on unmount and sign-out.
- Postgres Changes are hints. Merge by id/`seq`; ignore duplicates.
- On reconnect, fetch `GET /conversations/:id/messages?since_seq=<lastSeq>` before resuming.
- Never sort messages by `created_at`; use `seq`.
- Read receipts: call `POST /conversations/:id/read` with `upto_seq`. Delivery: `POST /messages/:id/delivered`.
- A non-participant gets `404`; show “not found”, not “forbidden”.
- Blocked/policy failures are deliberately generic (`403`); do not speculate in the UI.
- Typing state is ephemeral; clear it on blur/unmount/timeout.
- Message sends are limited (20/min, 200/day). A pre-accept cap may return `429` with a specific “request limit” message; surface the server text rather than assuming it is the rate limit. Do not queue unbounded retries.

---

## 11. Uploads

- Upload directly to Supabase Storage, then send the public URL to the API.
- Buckets and limits:
  - `assets`: PNG/JPEG/WebP, ≤10 MB
  - `theses`: PDF, ≤10 MB
- Path conventions: `avatars/<uid>-<ts>.jpg`, `posts/<uid>-<ts>.jpg`, `theses/<uid>/<ts>.<ext>`.
- Validate type/size **before** upload; show progress and allow cancel/retry.
- Do not accept arbitrary remote URLs for `avatar_url`, `image_url`, or `pdf_url`; the backend rejects them.
- Deleting a row does not delete the file. Do not promise file erasure.

---

## 12. UI/UX quality bar

- Mobile-first; works on small phones and tablets; safe areas respected.
- One primary action per screen; destructive actions visually separated.
- Consistent spacing, type scale, colors, and icons from the existing theme tokens.
- Accessible labels on icon-only buttons; minimum 44×44 touch targets; visible focus states on web.
- Empty/loading/error copy is specific, not generic (“No results for ‘marine biology’” beats “No data”).
- Do not add gradients, glassmorphism, or decorative animation that fights the existing design language.
- Keep list virtualization (FlatList) for feeds; avoid nested VirtualizedLists.
- Every screen has a clear back/close path and does not trap navigation.
- Confirm before leaving a dirty form.

---

## 13. Error handling snippets

```ts
// One consistent message extractor:
const message = (body: any, fallback: string) =>
  body?.error ?? body?.message ?? fallback;

// Validation:
if (res.status === 400 && body?.error === "Validation failed") {
  for (const f of body.fields ?? []) setFieldError(f.path, f.message);
}

// Suspension:
if (res.status === 403 && body?.code === "account_suspended") {
  router.replace("/suspended");
}

// Rate limit:
if (res.status === 429) {
  setBanner("Too many requests. Please wait a moment and try again.");
}
```

Do not display raw stack traces, SQL errors, or token values. Do not log request bodies containing personal data.

---

## 14. Definition of done

Before opening a PR:

- [ ] Every new control calls a documented route, or is disabled and logged in `docs/API-REQUESTS.md`.
- [ ] No backend/schema/migration edits.
- [ ] No direct Supabase table access; only Auth/Storage/Realtime as documented.
- [ ] Loading, empty, error, offline, unauthorized, and suspended states exist.
- [ ] Forms mirror the exact body schema; validation fields are shown.
- [ ] Pagination uses the correct cursor; no eager full-history fetches.
- [ ] Mutation responses (raw rows) are merged or refetched.
- [ ] Role-based hiding is treated as cosmetic; server errors are still handled.
- [ ] Realtime subscriptions and timers are cleaned up.
- [ ] Uploads check bucket/type/size.
- [ ] Accessibility: labels, touch targets, focus, contrast.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npx expo lint` passes (0 errors).
- [ ] Tested on a small phone viewport and with a slow/offline network.

---

## 15. When an endpoint is missing

Use [`API-REQUESTS.md`](./API-REQUESTS.md). One row per capability. Include the screen, the desired interaction, the payload you need, and why existing routes cannot do it. Do not implement a workaround that writes to the database directly.
