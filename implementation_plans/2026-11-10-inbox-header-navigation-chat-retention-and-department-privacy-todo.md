# Task List: Inbox Header Navigation, Chat Retention, P2P Friends & Messages, and Department Post Privacy

## Phase 1: Inbox Header & Desktop Navigation
- [x] Task 1: Add `DesktopTopBar` and back navigation to desktop inbox (`frontend/app/messages/index.tsx`, `frontend/app/messages/[id].tsx`, `MessagesSplit.tsx`).
- [x] Task 2: Enable `showBack` and `onBack` on `InboxPane` for desktop split view.

## Checkpoint: Phase 1
- [x] Desktop messages screen displays top bar and back button returning to home feed.

## Phase 2: Peer-to-Peer Friend Requests (Both Ways)
- [x] Task 3: Alias `router.post("/")` in `backend/routes/friendRouter.js` and use `sendFriendRequest` in `frontend/src/components/PeerPicker.tsx`.
- [x] Task 4: Verify symmetric friend request handling across directory, peer picker, and friends screen.

## Checkpoint: Phase 2
- [x] Friend requests succeed from PeerPicker and profile, appearing in recipient's requests list and converting to mutual friendship on accept.

## Phase 3: Chat Retention & Persistent Conversations
- [x] Task 5: Backend - add `GET /api/conversations/:id` endpoint and update `canMessage` to grant automatic `direct` status to admin roles (`backend/routes/conversationRouter.js`, `backend/controllers/messageController.js`, `backend/models/messageModel.js`).
- [x] Task 6: Frontend - update `ChatsPopover.tsx` and `DesktopLayout.tsx` (`MessagesSidebar`) to load real conversations from `/conversations` instead of `/friends`.
- [x] Task 7: Frontend - update `ThreadPane.tsx` to fetch conversation details via `GET /api/conversations/:id` when deep-linking.

## Checkpoint: Phase 3
- [x] Admin chats and peer conversations remain listed in top bar popover and inbox across sessions and refreshes, even when user is offline or inactive.

## Phase 4: Department Filter Removal & Post Privacy Scoping
- [x] Task 8: Remove department pill filter bar from `frontend/app/(tabs)/index.tsx`.
- [x] Task 9: Database & Backend - create migration `036_department_post_visibility.sql` adding `'department'` to `content_visibility` and update `visible_posts()`; update `backend/validation/index.js` and `backend/models/postModel.js`.
- [x] Task 10: Frontend - update `ContentVisibility` in `frontend/src/types.ts`, `VisibilityPicker.tsx`, and composers (`create.tsx`, `post-settings.tsx`, `upload-thesis.tsx`).

## Checkpoint: Complete
- [x] `cd frontend && npx tsc --noEmit` exits with 0 errors.
- [x] `cd backend && npm test` passes (411 passing unit tests and contracts).
- [x] All requirements verified end-to-end.
