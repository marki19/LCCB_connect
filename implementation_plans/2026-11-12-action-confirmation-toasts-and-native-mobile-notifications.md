# Action Confirmation Toasts & Mobile Native OS Notifications

## Goal
1. Standardize Action Confirmation Toasts across all user roles (superadmin, admin, department admin, faculty, student) when they perform mutating actions.
2. Restrict in-app real-time notification toasts to Web only.
3. Use real native OS notifications (`expo-notifications` system heads-up and background pushes) on Mobile so they pop down and sit in the phone's notification tray.

---

## Tasks

- [x] **Task 1: Mobile Native Notification & Web Toast Separation**
  - Update `frontend/src/contexts/ToastContext.tsx`:
    - Only show incoming realtime notification toasts on `Platform.OS === 'web'`.
    - On mobile, delegate incoming realtime notifications to `presentLocalNotification`.
  - Update `frontend/src/lib/push.ts`:
    - Add `presentLocalNotification({ title, body, data })`.
    - Enhance tap handler to route announcements (`/post/:id`), messages (`/messages/:id`), and friend requests (`/friends`).

- [x] **Task 2: Backend Push Fan-out for Announcements**
  - Update `backend/controllers/announcementController.js`:
    - Send Expo push notifications to mobile recipients asynchronously via `pushService.sendToUser`.

- [x] **Task 3: Admin & Moderation Confirmation Toasts**
  - Wire `showToast` into:
    - Announcements: send, edit, delete ([`frontend/app/(admin)/announcements.tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/app/(admin)/announcements.tsx))
    - Verification Queue: approve, decline ([`frontend/app/verify-requests.tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/app/verify-requests.tsx))
    - Admin Moderation: suspend, unsuspend, content hide/delete ([`frontend/app/(admin)/users.tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/app/(admin)/users.tsx), `content.tsx`)

- [x] **Task 4: Student & Community Confirmation Toasts**
  - Wire `showToast` into:
    - Post Creation & Edit ([`frontend/app/create.tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/app/create.tsx))
    - Post Deletion & Bookmarking ([`frontend/src/components/PostMenu.tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/src/components/PostMenu.tsx), [`PostCard.tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/src/components/PostCard.tsx))
    - User Block / Unblock ([`frontend/src/components/BlockConfirmDialog.tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/src/components/BlockConfirmDialog.tsx))
    - Content Reports ([`frontend/src/components/ReportDialog.tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/src/components/ReportDialog.tsx))
    - Profile Update ([`frontend/app/edit-profile.tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/app/edit-profile.tsx))
    - Friend Requests Send / Accept / Remove ([`frontend/app/friends.tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/app/friends.tsx), [`PeerPicker.tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/src/components/PeerPicker.tsx), [`profile/[id].tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/app/profile/[id].tsx))
    - Onboarding Verification Submission ([`frontend/app/onboarding.tsx`](file:///c:/Programming%20Projects/third-year/LCCB_connect/frontend/app/onboarding.tsx))

- [x] **Task 5: Verification & Quality Assurance**
  - Run `cd backend && node --require dotenv/config --test`
  - Run `cd frontend && npx tsc --noEmit`

