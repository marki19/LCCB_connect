# Implementation Plan: Stable File URLs for Public Categories and Google Avatar Mirror

## Overview
Move public categories (`avatars`, `posts`, `videos`) from dynamic presigned Supabase URLs to stable `/api/files` URLs, while preserving presigned URLs for private categories (`theses`, `documents`). Additionally, unify avatar rendering into a single standard component (`Avatar.tsx`), mirror Google avatars locally to eliminate third-party image rot, and provide a user action to remove custom profile photos.

## Slices

### Slice A — `resolveFileUrl` on the Client (No Behaviour Change)
1. Create `frontend/src/lib/files.ts`:
   - `fileUrl(key: string): string`
   - `resolveFileUrl(value: string | null | undefined): string | null` (returns null if empty, returns value as-is if already absolute `https?:`, `data:`, `blob:`, `file:`, else prepends API files origin)
   - `resolveFileUrls(list: (string | null | undefined)[]): string[]`
2. Re-export `fileUrl` from `frontend/src/lib/api.ts` for backwards compatibility; update `chatMedia.ts` to import from `files.ts`.
3. Audit and wrap every read site with `resolveFileUrl` so when the backend switches to keys, the frontend resolves them seamlessly:
   - `frontend/app/edit-profile.tsx`
   - `frontend/app/profile/[id].tsx`
   - `frontend/app/friends.tsx`
   - `frontend/app/(tabs)/search.tsx`
   - `frontend/app/(tabs)/index.tsx`
   - `frontend/app/(admin)/users/index.tsx`
   - `frontend/app/(admin)/users/[id].tsx`
   - `frontend/src/components/DesktopLayout.tsx`
   - `frontend/src/components/InlineCommentsDrawer.tsx`
   - `frontend/src/components/DesktopContactsRail.tsx`
   - `frontend/src/components/ChatsPopover.tsx`
   - `frontend/src/components/PeerPicker.tsx`
   - `frontend/src/components/PostCard.tsx`
   - `frontend/src/components/PostImageGallery.tsx`
   - `frontend/src/components/RepostCard.tsx`

### Slice B — One Avatar Renderer
1. Upgrade `frontend/src/components/Avatar.tsx`:
   - Accept `avatarUrl?: string | null` (resolved through `resolveFileUrl`).
   - Render `<Image>` when valid `avatarUrl` is present, with fallback to initials avatar on error or empty URL.
2. Clean up duplicated or hand-rolled avatar circle implementations:
   - Remove duplicate helper in `DesktopLayout.tsx`.
   - Replace hand-rolled initials circles in `PostCard.tsx` and `app/(tabs)/profile.tsx` with `<Avatar>`.
3. Wire own avatar:
   - `DesktopTopBar`, `AccountPopover`, `DesktopLeftRail`, `InlineCommentsDrawer`, `InboxPane`, profile tab.
4. Wire peer avatars:
   - `PeerPicker`, `SuggestionCarousel`, `profile/[id]`, `friends`, `search`, `InboxPane`, `ThreadPane`, `ChatsPopover`, `DesktopContactsRail`, `FloatingChatWindow`, `NotificationsPopover`, feed post cards.

### Slice C — Backend Returns Keys for Public Categories
1. Update `backend/services/storageService.js`:
   - For public categories (`avatars`, `posts`, `videos`), `withStorageUrls` / `expand` leaves the stored key as-is (e.g. `avatars/xyz.jpg` or `posts/abc.jpg`).
   - For private categories (`theses`, `documents` / `pdf_url`), continue issuing presigned URLs via `signKey`.
2. Update `objectStorage.js` / upload handlers:
   - Add `Cache-Control: public, max-age=31536000, immutable` for public category objects at upload.
3. Tests in `backend/tests/storageService.test.js`:
   - Assert public fields (`avatar_url`, `image_url`, `image_urls`, `video_url`) stay as keys.
   - Assert private fields (`pdf_url`) receive signed URLs.

### Slice D — Google Avatar Mirror
1. Migration `backend/migrations/048_google_avatar_mirror.sql`:
   - Add `avatar_source` (`'google'` | `'upload'`) and `google_avatar_url TEXT` to `users` and `profiles`.
   - Backfill existing rows with `avatar_url IS NOT NULL` to `avatar_source = 'upload'`.
2. Create `backend/services/googleAvatar.js`:
   - Check host matches Google domains (`*.googleusercontent.com`).
   - Strip resize suffix `=s\d+(-c)?`.
   - Skip if `google_avatar_url` is already identical to the upstream URL.
   - Fetch upstream photo with 2 MB cap and `image/*` MIME check.
   - Store buffer via `storeUpload({ category: "avatars" })`.
   - Delete old mirrored object if replacing previous Google avatar.
   - Update `avatar_url`, `avatar_source = 'google'`, `google_avatar_url`.
3. In `backend/controllers/authController.js`:
   - On Google login / signup, invoke `mirrorGoogleAvatar(user.id, pictureUrl)` in background; swallow errors so login is never blocked.
   - Skip if `avatar_source === 'upload'`.

### Slice E — Remove Photo
1. Route `DELETE /api/users/me/avatar` in `backend/routes/userRouter.js` and `backend/controllers/userController.js`:
   - Set `avatar_url = NULL`, `avatar_source = NULL`, `google_avatar_url = NULL`.
2. In `frontend/src/lib/api.ts`:
   - Add `deleteAvatar(): Promise<any>`.
3. In `frontend/app/edit-profile.tsx`:
   - Add "Remove photo" action when user currently has an avatar.
   - On confirmation, calls `deleteAvatar()`.

### Slice F — Verification
1. Run backend tests (`npm --prefix backend test`).
2. Run frontend type check (`npx --prefix frontend tsc --noEmit`).
3. Run frontend tests (`npm --prefix frontend test`).
4. Run frontend build (`npm --prefix frontend run build`).
5. Verify zero regressions in image and avatar rendering across desktop and mobile.
