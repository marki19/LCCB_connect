# API Requests — LCCB Connect

> **Purpose:** the single place to record a UI capability that has **no backend endpoint**.
> A missing endpoint is a hard block: the UI ships a disabled control, not a fake one.
> Full endpoint list: [`BACKEND_CONTRACT.md`](./BACKEND_CONTRACT.md).

---

## How to use this file

1. Check `BACKEND_CONTRACT.md` §6 first. The route may already exist under a different name.
2. Check the **Open requests** and **Candidate backlog** below to avoid duplicates.
3. Add one request per capability. Do not bundle unrelated fields into one entry.
4. Keep the UI blocked until the request is marked **Done** and the route is added to the contract.
5. The backend maintainer owns status changes. Do not mark your own request **Done**.

### Status legend

| Status | Meaning |
| --- | --- |
| `Idea` | Identified gap; not yet needed by a screen |
| `Open` | Needed now; UI is blocked |
| `Accepted` | Backend maintainer agreed; not implemented |
| `In progress` | Being implemented |
| `Partial` | Some filters/behavior shipped; the remaining gap is documented |
| `Done` | Route exists and is documented in `BACKEND_CONTRACT.md` |
| `Declined` | Not planned; UI must not build it |

### Request template

```md
### API-REQ-000 — <short capability name>

- **Status:** Open
- **Requested by:** <name / agent>
- **Date:** YYYY-MM-DD
- **Screen(s):** `frontend/app/...`
- **Capability:** <what the user must be able to do>
- **Why existing endpoints cannot do it:** <specific gap>
- **Proposed request:** `METHOD /api/...` with body/query
- **Response needed:** <shape the UI must render>
- **Permissions:** <who may call it>
- **Priority:** P0 (blocks a screen) / P1 (blocks a key flow) / P2 (nice to have)
- **Notes:** <edge cases, limits, pagination>
```

---

## Summary

| ID | Capability | Screen | Status | Route added |
| --- | --- | --- | --- | --- |
| API-REQ-001 | Admin/system settings read + update | `(admin)/settings.tsx` | **Open** | — |
| API-REQ-002 | Server-side search across posts/theses/people | Search, Home | **Done** | `GET /posts?q=`, `GET /theses?q=`, `GET /public/peers?q=` |
| API-REQ-003 | Posts/theses by user (“my posts”) | Profile | **Done** | `GET /posts?author_id=`, `GET /theses?uploader_id=` (public equivalents too) |
| API-REQ-004 | Bookmarks / saved items | Post detail, Profile | Idea | — |
| API-REQ-005 | User report for posts/comments/theses | Post/thesis detail | Idea | — |
| API-REQ-006 | Edit/delete/resend announcements | Admin announcements | Idea | — |
| API-REQ-007 | Message edit/delete, thread archive/delete | Messages | Idea | — |
| API-REQ-008 | Group conversations | Messages | Idea | — |
| API-REQ-009 | Notification preferences | Settings | Idea | — |
| API-REQ-010 | Friend suggestions / mutual friends | Friends | Idea | — |
| API-REQ-011 | Staff directory filters (role/department) | Home/Search | **Partial** | `GET /public/peers?q=&department_id=&year_level=` (role filter missing) |
| API-REQ-012 | Bulk admin actions / CSV export | Admin users/content | Idea | — |
| API-REQ-013 | Storage cleanup / media library | Post/thesis delete | Idea | — |
| API-REQ-014 | Unread-total / badge endpoint | Home, Messages | **Done** | `GET /conversations/unread-count` |
| API-REQ-015 | Thesis analytics (views/downloads) | Thesis detail | Idea | — |
| API-REQ-016 | List device tokens for current user | Settings/Push | Idea | — |
| API-REQ-017 | Faculty adviser review / thesis approval workflow | Faculty/department screens | Idea | — |

---

## Open requests

### API-REQ-001 — Admin/system settings read + update

- **Status:** Open
- **Requested by:** Frontend (admin settings screen)
- **Date:** 2026-10-20
- **Screen(s):** `frontend/app/(admin)/settings.tsx`
- **Capability:** An admin can view and change institution-level settings (the current screen is a stub reading “Settings form will be implemented here.”). The exact setting keys have **not** been defined by product; this request is for the resource and its contract, not a UI-invented field list.
- **Why existing endpoints cannot do it:** There is no settings table, model, controller, or route anywhere in `backend/`. `/api/admin/*` covers users, content, audit, announcements, departments, and courses only. Catalog routes are not a settings store.
- **Proposed request:**
  - `GET /api/admin/settings` → the current settings object
  - `PUT /api/admin/settings` → partial update (strict schema)
  - Requires `admin` or `superadmin`; changes written to `admin_audit_log`
- **Response needed:** A stable JSON object with typed keys (booleans/strings/numbers), plus `updated_at` and `updated_by`. Unknown keys rejected. UI needs each field's type, default, and validation limits to render controls.
- **Permissions:** `admin` / `superadmin` (read and write). Decide whether `departmentAdmin` may read a subset.
- **Priority:** P2 — the screen is a stub; no core flow is blocked, but the admin navigation advertises it.
- **Notes:** Do not ship a settings form against invented keys. If product only needs a read-only “About this deployment” panel, a smaller endpoint is acceptable. Add environment/deployment info only if it is safe to expose to admins.

---

## Candidate backlog

These are known gaps from `BACKEND_CONTRACT.md` §11. They are **not** approved work and the UI must not build them. Promote one to **Open** when a screen needs it.

### API-REQ-004 — Bookmarks / saved items

- No save/list-saved route. Likes are the only reaction.

### API-REQ-005 — User reports for posts/comments/theses

- Only messages can be reported. Posts/comments/theses rely on the AI scan and admin action.
- Needed: a participant-facing report route that feeds the moderation queue, with a reason and dedupe.

### API-REQ-006 — Announcement lifecycle

- Only send + list exist. Editing, deleting, and resending are impossible.
- Clarify whether announcements are immutable audit records (recommended) or editable drafts.

### API-REQ-007 — Message/thread lifecycle

- No edit/delete message, archive/delete thread, or mark-unread. Only mute and read.
- Clarify retention/audit requirements before adding delete.

### API-REQ-008 — Group conversations

- Schema and routes are strictly 1:1 (`user_a`/`user_b`). Groups require a data-model change, not a UI toggle.

### API-REQ-009 — Notification preferences

- Only message policy and presence are user-configurable. No email/digest/push-category preferences.
- Need a defined set of channels/categories before a form can be built.

### API-REQ-010 — Friend suggestions / mutual friends

- No suggestions endpoint or mutual-friend counts.

### API-REQ-011 — Directory filters for non-admins

- `/public/peers` now accepts `q`, `department_id`, and `year_level`; it remains a keyset page with limited fields. The peer picker uses `q`; `department_id`/`year_level` still have no UI. There is no `role` filter. `/users` is admin-only.
- Remaining: decide whether non-admins may filter by `role`; if yes, add it without exposing role in the public payload.

### API-REQ-012 — Bulk admin actions / export

- Every admin action is one row per request. No CSV/export endpoint. Consider async jobs before bulk delete.

### API-REQ-013 — Storage cleanup / media library

- Deleting a post/thesis row leaves the file in Storage. No deletion or listing API.
- Needed: a safe, owner-scoped cleanup route or a documented retention job. Do not expose arbitrary delete.

### API-REQ-015 — Thesis analytics

- No view/download counters. Downloads go directly to Storage, so a counter needs either a redirect route or client event reporting.

### API-REQ-016 — Device token listing

- Tokens can be added/removed by value but not listed. Useful for a “signed-in devices” settings panel; requires care with token secrecy.

### API-REQ-017 — Faculty adviser review / thesis approval

- The `faculty` role exists, but it has no extra endpoint: theses are auto-approved on upload and only the AI/admin moderation path can hide or flag them. There is no adviser assignment, review queue, revision request, or defense workflow.
- Needed: a defined workflow (who assigns advisers, what states a thesis moves through, who can approve) before any route or UI can be designed.
- Affects: any faculty/departmentAdmin screen the product envisions; currently blocked.

---

## Completed requests

| ID | Capability | Route added | Date | Contract section |
| --- | --- | --- | --- | --- |
| API-REQ-002 | Server-side search across posts/theses/people | `GET /posts?q=`, `GET /theses?q=`, `GET /public/posts?q=`, `GET /public/theses?q=`, `GET /public/peers?q=` | 2026-10-21 | §6.1, §6.4, §6.5 |
| API-REQ-003 | Posts/theses by user | `GET /posts?author_id=`, `GET /theses?uploader_id=` (+ public equivalents) | 2026-10-21 | §6.1, §6.4, §6.5 |
| API-REQ-014 | Unread total | `GET /conversations/unread-count` | 2026-10-21 | §6.7 |

When a request is completed, move it here and update `BACKEND_CONTRACT.md` in the same change. Never leave a **Done** row whose route is absent from the contract.
