# Task List: Real-Time TopBar Notification & Message Badges

## Phase 1: Backend Endpoint & Routing
- [x] Task 1.1: Create `backend/routes/notificationRouter.js` and mount `/api/notifications` in `backend/app.js`
- [x] Task 1.2: Write automated unit tests in `backend/tests/notification.test.js`
- [x] Checkpoint: Verify all backend tests pass cleanly (393/393 pass)

## Phase 2: Realtime TopBar Integration
- [x] Task 2.1: Add live state and Supabase Realtime event listeners in `frontend/src/components/topbar/DesktopTopBar.tsx`
- [x] Task 2.2: Refine `frontend/src/components/topbar/NotificationsPopover.tsx` to handle `is_read`, actor name, and badge sync
- [x] Task 2.3: Pass dynamic unread counts in `DesktopLayout.tsx` to keep left rail in sync
- [x] Checkpoint: Run `npx tsc --noEmit` and verify zero errors
