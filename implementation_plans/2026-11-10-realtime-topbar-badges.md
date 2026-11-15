# Real-Time TopBar Notification & Message Badges — Implementation Plan

## Problem Statement
TopBar notification bell and message icon badges are not synchronized with real-time updates:
1. `DesktopLayout.tsx` hardcoded `notificationCount={0}`.
2. In `backend/app.js`, `/api/notifications` was not mounted as a standalone router (it was only nested inside `/api/moderation`), causing calls to `/notifications` to 404.
3. Message unread count was only fetched once on layout mount, without updating when new messages arrive.
4. Notifications were not updating live when likes, comments, friend requests, or announcements occur.

## Proposed Solution
1. **Backend Routing & Model**:
   - Create `backend/routes/notificationRouter.js` mounting `GET /`, `GET /unread-count`, `PUT /:id/read`, `POST /read-all`.
   - Mount `/api/notifications` in `backend/app.js` with authentication and profile loading.
   - Write automated unit tests in `backend/tests/notification.test.js`.
2. **Realtime Sync in TopBar**:
   - In `DesktopTopBar.tsx`, subscribe to Supabase Realtime via `onMessage`, `onConversation`, and `onNotification` from `frontend/src/lib/realtime.ts`.
   - Keep internal state for `liveUnreadCount` and `liveNotificationCount`.
   - Fetch initial counts on mount via `/conversations/unread-count` and `/notifications/unread-count`.
   - Increment/update counts reactively upon real-time events.
3. **NotificationsPopover Refinement**:
   - Align property names with database columns (`is_read`, `actor.full_name`).
   - On individual click, mark notification read and decrement badge count.
   - On "Mark all read", clear notification badge count.
4. **Verification**:
   - Backend unit tests pass.
   - Frontend TypeScript check passes (`0 errors`).
   - SVG-only icon audit (zero emojis).

