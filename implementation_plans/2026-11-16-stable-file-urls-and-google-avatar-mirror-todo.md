# Task List: Stable File URLs and Google Avatar Mirror

## Slice A: Client `resolveFileUrl` (No Behaviour Change)
- [x] Task A1: Create `frontend/src/lib/files.ts` (`fileUrl`, `resolveFileUrl`, `resolveFileUrls`) and re-export `fileUrl` from `frontend/src/lib/api.ts`.
- [x] Task A2: Update `frontend/src/lib/chatMedia.ts` to import `fileUrl` from `files.ts`.
- [x] Task A3: Wire `resolveFileUrl` in user profile pages (`edit-profile.tsx`, `profile/[id].tsx`, `friends.tsx`, `app/(tabs)/search.tsx`, `app/(admin)/users/index.tsx`, `app/(admin)/users/[id].tsx`).
- [x] Task A4: Wire `resolveFileUrl` in desktop layout and widgets (`DesktopLayout.tsx`, `InlineCommentsDrawer.tsx`, `DesktopContactsRail.tsx`, `ChatsPopover.tsx`, `PeerPicker.tsx`).
- [x] Task A5: Wire `resolveFileUrl` in feed cards and galleries (`app/(tabs)/index.tsx`, `PostCard.tsx`, `PostImageGallery.tsx`, `RepostCard.tsx`).

## Slice B: Unified Avatar Renderer
- [x] Task B1: Upgrade `Avatar.tsx` with `avatarUrl` prop, `<Image>` rendering, and initials fallback on error.
- [x] Task B2: Replace hand-rolled avatar circle implementations in `DesktopLayout.tsx`, `PostCard.tsx`, and `app/(tabs)/profile.tsx`.
- [x] Task B3: Wire own avatar in `DesktopTopBar`, `AccountPopover`, `DesktopLeftRail`, `InlineCommentsDrawer`, `InboxPane`, profile tab.
- [x] Task B4: Wire peer avatars across `PeerPicker`, `SuggestionCarousel`, `profile/[id]`, `friends`, `search`, `InboxPane`, `ThreadPane`, `ChatsPopover`, `DesktopContactsRail`, `FloatingChatWindow`, `NotificationsPopover`, feed cards.

## Slice C: Backend Returns Keys for Public Categories
- [x] Task C1: Update `backend/services/storageService.js` so public categories (`avatars`, `posts`, `videos`) return the stored key while private categories (`theses`, `documents`) remain presigned.
- [x] Task C2: Set immutable public cache headers in upload handling.
- [x] Task C3: Add/update tests in `backend/tests/storageService.test.js`.

## Slice D: Google Avatar Mirror
- [x] Task D1: Create migration `backend/migrations/048_google_avatar_mirror.sql`.
- [x] Task D2: Create `backend/services/googleAvatar.js` with domain checks, size/MIME limits, and storage deduplication.
- [x] Task D3: Integrate mirror call in `backend/controllers/authController.js` on Google auth.

## Slice E: Remove Photo Action
- [x] Task E1: Implement `DELETE /api/users/me/avatar` in `backend/routes/userRouter.js` and `backend/controllers/userController.js`.
- [x] Task E2: Add `deleteAvatar()` in `frontend/src/lib/api.ts`.
- [x] Task E3: Add "Remove photo" button in `frontend/app/edit-profile.tsx`.

## Slice F: Verification
- [ ] Task F1: Run backend tests (`npm --prefix backend test`).
- [ ] Task F2: Run frontend typecheck (`npx --prefix frontend tsc --noEmit`).
- [ ] Task F3: Run frontend tests (`npm --prefix frontend test`).
- [ ] Task F4: Run frontend production build (`npm --prefix frontend run build`).
