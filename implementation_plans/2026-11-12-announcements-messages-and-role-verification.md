# Announcements as Posts, Messages Out of Notifications, Role-Specific Verification

Supersedes `2026-11-11-announcements-as-posts.md` (that plan made announcements
`visibility='public'` with `allow_reposts: false`; both are now wrong — audiences
are scoped and announcements must be shareable).

## Problem

1. **Messages land in the bell.** `messageModel.sendMessage` writes a
   `notifications` row (`new_message` / `message_request`), and
   `notifications.tsx` routes those rows to the chat. Push already fires
   independently via `pushService.notifyNewMessage`, so the notification row is
   pure noise: a duplicate surface for something that belongs in Messages only.
2. **Announcements never reach the feed.** `adminController.sendAnnouncement`
   only inserts `notifications` rows. No `posts` row is created, so
   `visible_posts()` can never return one.
3. **Every role gets the student verification form.** `verificationSubmitSchema`
   requires `department_id`/`course_id`/`year_level` for all roles, and
   `profile_verification_requests` has them `NOT NULL`. There is no OTP anywhere
   in verification — admin review is the only gate.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Announcements are `posts` rows: `type='announcement'`, `visibility='announcement'` | likes/comments/reposts FK to `posts.id`, so engagement is free |
| 2 | Audience = five nullable columns on `posts`; NULL means unconstrained | one `visible_posts()` branch instead of a union of cases; combinations (course + year) work with no new code |
| 3 | Announcement audience is immutable after send | notification fan-out is a snapshot; changing audience cannot un-notify or notify retroactively |
| 4 | Editing rewrites the notification message in the same transaction | bell text and feed post never disagree |
| 5 | Deleting soft-deletes the post and hard-deletes its notification rows | no dead links in the bell |
| 6 | Expired announcements leave `visible_posts()` but keep their row | likes and comments are not destroyed |
| 7 | `visible_reposts()` gains a `visible_posts()` check | pre-existing hole: a repost of a private post is currently visible |
| 8 | Staff ID format `[A-Z]{2,4}-\d{4,8}` | temporary; one constant to swap when the real format arrives |
| 9 | Superadmins never verify | they are the top of the hierarchy |
| 10 | `requireVerified` unchanged | `middleware/auth.js:281` already exempts non-students; the bug is frontend + a missing role check |

## Approval Matrix

| Requester | Reviewers |
|---|---|
| `superadmin` | never verifies |
| `admin` | superadmin |
| `departmentAdmin` | superadmin, admin |
| `faculty` | department admin, own department only |
| `student` | department admin, own department only |

## Announcement Audience Scope

| Role | May target |
|---|---|
| `departmentAdmin` | `department`, `course`, `year_level` |
| `admin`, `superadmin` | `department`, `course`, `year_level`, `role`, `all` |

Department admins are additionally restricted to their own department.

## Tasks

- [x] **1. Apply migration 036** — department visibility.
  - Ruling: 036 could not run as written. `ALTER TYPE ... ADD VALUE` cannot share a
    transaction with statements that use the new value (implicit transaction from
    `run-sql.js`), so the enum was applied separately.
  - Ruling: 036's `visible_theses` branch referenced `t.course_id`, which does not
    exist on `theses`. Changed to `t.department_id` (the column that does exist)
    and kept the uploader-department fallback. Cost if wrong: department theses
    visible to the wrong department.
- [ ] **2. Messages out of notifications** — remove the two `notifyUser` writes,
  filter both types out of the read queries, prune existing rows.
- [ ] **3. `039_announcement_posts.sql`** — enum value, post type, six columns,
  `visible_posts()` + `visible_reposts()` rewrite.
- [ ] **4. `/api/announcements`** — new mount, create/edit/delete/pin, audience
  mapping, department-admin scope.
- [ ] **5. `040_verification_roles.sql` + OTP** — kind/role columns, nullable
  fields, per-role CHECK, `verification_otp`, OTP endpoints, queue matrix.
- [ ] **6. Frontend** — three verification forms, composer, feed badge,
  notifications cleanup.

## Ledger

- 036 applied: enum split-run, `visible_theses` course_id → department_id.
