# Task List: expo-image + Stable Cache Key Migration

## Slice 1: expo-image + Wrapper
- [ ] Task 1: Install `expo-image` dependency (`npx expo install expo-image` in `frontend/`)
- [ ] Task 2: Implement `fileKeyFromUrl(uri)` in `frontend/src/lib/files.ts`
- [ ] Task 3: Create `frontend/src/components/AppImage.tsx` wrapper with `cachePolicy="memory-disk"`, `transition={150}`, automatic `cacheKey` and `contentFit="cover"`

## Slice 2: Swap Network Image Sites
- [ ] Task 4: Swap `<Image>` to `<AppImage>` in `PostImageGallery.tsx`, `Avatar.tsx`, `PostCard.tsx`, and `RepostCard.tsx`
- [ ] Task 5: Swap `<Image>` to `<AppImage>` in `app/post/[id].tsx`, `app/saved.tsx`, `app/profile/[id].tsx`, and `app/edit-profile.tsx`
- [ ] Task 6: Swap `<Image>` to `<AppImage>` in `ChatImageBubble.tsx`, `ChatImageLightbox.tsx`, `HomeHeader.tsx`, `DesktopTopBar.tsx`, and admin/auth screens

## Slice 3: Delete Per-Mount Re-Signing
- [ ] Task 7: Remove redundant per-mount image re-signing in `PostCard.tsx` and `app/post/[id].tsx`

## Slice 4: Prefetching & Cache Configuration
- [ ] Task 8: Implement `usePrefetchImages` hook and wire prefetch into feed scrolling
- [ ] Task 9: Configure image cache sizing at mobile app startup

## Slice 5: Verification & Quality Gates
- [ ] Task 10: Run TypeScript checks, vitest tests, and web export build
