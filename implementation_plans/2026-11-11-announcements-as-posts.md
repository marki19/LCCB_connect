# Announcements as Posts — Implementation Plan

## Problem

Admin announcements are stored as `notifications` rows (`type: 'announcement'`), not as `posts` rows. The news feed only queries `posts` (via `visible_posts()`), so announcements never appear in the feed. The Notifications tab shows them but with a generic icon and dead click handler.

## Goal

Announcements appear in the news feed as posts with `type: 'announcement'`, visible to the same audience rules as regular posts. The notification record stays for the unread badge.

## Files to Change

### 1. `backend/migrations/035_announcement_post_type.sql` (NEW)

```sql
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_type_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_type_check
  CHECK (type = ANY (ARRAY['text','image','project','capstone','website','announcement']));
```

### 2. `backend/validation/index.js`

- `postFields.type` enum: add `'announcement'`
- `createPostSchema` / `updatePostSchema` inherit it

### 3. `backend/controllers/adminController.js` — `sendAnnouncement`

Replace the notification-only insert with a post creation:

```javascript
// Create the announcement as a post so it appears in the feed
const post = await postModel.createPost({
  author_id: req.user.id,
  type: 'announcement',
  title,
  content: body,
  visibility: 'public',  // configurable later
  allow_reposts: false,
  moderation_status: 'approved',
});

// Still create notification records for the badge
await adminModel.createAnnouncementNotifications({
  recipients: recipients.map(r => r.id),
  actorId: req.user.id,
  announcementId: post.id,  // reuse post id as the announcement id
  departmentId: ...,
  departmentName,
  message: `${title}\n\n${body}`,
});
```

### 4. `backend/models/adminModel.js` — `createAnnouncementNotifications`

No change needed — it already inserts `type: 'announcement'` notifications. The `announcementId` now comes from the post's UUID.

### 5. `frontend/src/types.ts`

- `PostType`: add `'announcement'`

### 6. `frontend/app/create.tsx`

- `PostType`: add `'announcement'`
- Hide announcement type from the post-type selector (admin-only, separate flow)

### 7. `frontend/src/components/PostCard.tsx`

- Handle `type === 'announcement'`: render with a distinct visual (e.g. Megaphone icon, accent border)
- Show title prominently (announcements have titles)

### 8. `frontend/app/(tabs)/notifications.tsx`

- `renderIcon`: add `case 'announcement': return { Icon: Megaphone, tone: 'accent' }`
- `handleMarkAsRead`: add `case 'announcement':` — navigate to the post if `entity_id` exists

## Verification

- Backend: `npm test` — all 409+ tests pass
- Frontend: `tsc --noEmit` clean, lint clean
- Manual: admin sends announcement → appears in news feed with announcement styling → notification badge appears → clicking notification opens the announcement post

## Rollout Notes

- Existing announcements (already sent as notifications) remain in notifications tab only; no backfill needed.
- New announcements go to both feed and notifications.
- `allow_reposts: false` prevents sharing announcements.