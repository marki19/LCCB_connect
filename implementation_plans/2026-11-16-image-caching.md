# Implementation Plan: expo-image + Stable Cache Key Migration

## Problem Statement
The app currently re-renders and re-fetches network images because presigned storage URLs or cache keys change, causing image flickers and unneeded bandwidth usage on screen transitions and feed scrolling.
By adopting `expo-image` with content-addressed cache keys (`source.cacheKey`) derived from storage keys (`posts/<hash>.jpg`, `avatars/<hash>.jpg`), images are found on disk/memory before network requests are dispatched, eliminating reloading on tab switches and feed revisits.

## Architecture

### 1. `fileKeyFromUrl` in `src/lib/files.ts`
Derive the content-addressed key automatically:
- Input: `/api/files/posts/abc.jpg` or `http://.../api/files/posts/abc.jpg`
- Output: `posts/abc.jpg`
- If not a `/api/files/<category>/<file>` URL (e.g. Google avatar, external link preview): returns `undefined`.

### 2. Universal `<AppImage>` Wrapper in `src/components/AppImage.tsx`
- Wraps `expo-image`'s `Image`.
- Automatically sets `cachePolicy="memory-disk"`, `transition={150}`, and extracts `source.cacheKey` via `fileKeyFromUrl` when `source` is a URI string or `{ uri: string }`.
- Sets default `contentFit="cover"`.
- Supports `recyclingKey` based on `cacheKey` or `uri` to optimize list item re-use.
- Supports onError fallback (or forwards to existing callers).

### 3. Replace `<Image>` Call Sites with `<AppImage>`
Network image sites:
- `PostImageGallery.tsx`
- `app/post/[id].tsx`
- `app/saved.tsx`
- `Avatar.tsx`
- `PostCard.tsx`
- `RepostCard.tsx`
- `ChatImageBubble.tsx`
- `ChatImageLightbox.tsx`
- `app/profile/[id].tsx`
- `app/edit-profile.tsx`
- `HomeHeader.tsx`
- `DesktopTopBar.tsx`
- Admin/auth screens
Local-file previews (`create.tsx` picker, `FloatingChatWindow` thumb) remain unchanged as local file URIs.

### 4. Remove Per-Mount Re-Signing
- Delete unnecessary re-signing calls in `PostCard.tsx:118-135` and `post/[id].tsx:159-175` that cause unnecessary network requests on mount.

### 5. Prefetching & Cache Configuration
- `usePrefetchImages` hook utilizing `Image.prefetch(urls, 'memory-disk')`.
- Configure cache sizing at startup (`Image.configureCache({ maxDiskSize: 200 * 1024 * 1024 })` on iOS/mobile).

## Verification Gates
- `tsc -p frontend/tsconfig.json --noEmit` -> 0 errors.
- `npm --prefix frontend test` -> 38/38 vitest passing.
- `npm --prefix frontend run build` -> Expo web export cleanly compiles.
- `npm --prefix backend test` -> 675/675 passing.
