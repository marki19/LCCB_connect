# Quick Snap / Stories System — Implementation Plan

**Date:** 2026-11-19  
**Branch:** `mark1e3`  
**Status:** In Planning  

---

## 1. Current State vs. Goal

- **Current State**: `StoryActionModal.tsx` uploads bytes to `snaps/<hash>` in Supabase storage and emits a toast. No database record is inserted, no query exists to retrieve active stories, and no viewer or feed display exists.
- **Goal**: Complete end-to-end 24-hour Story (Quick Snap) lifecycle:
  1. Storage + Database record creation with 24-hour TTL (`expires_at = now() + 24 hours`).
  2. Horizontal Story Rail on Feed (`SnapRail.tsx`) and unviewed story rings on Avatars.
  3. Fullscreen Story Viewer (`SnapViewer.tsx`) with progress bar, tap to skip, reactions, and reply drawer.

---

## 2. Architecture & Data Flow

### Database (`backend/migrations/059_quick_snap.sql`)
- Table `snaps`:
  - `id`: UUID (primary key)
  - `author_id`: TEXT (references `profiles.id` on delete cascade)
  - `media_key`: TEXT (storage path, e.g. `snaps/f0b...png`)
  - `media_type`: TEXT ('image' or 'video')
  - `caption`: TEXT (optional)
  - `visibility`: `content_visibility` enum ('public', 'friends', 'department', 'private')
  - `created_at`: TIMESTAMPTZ (default `now()`)
  - `expires_at`: TIMESTAMPTZ (default `now() + interval '24 hours'`)
- Table `snap_views`:
  - `snap_id`: UUID (references `snaps.id`)
  - `viewer_id`: TEXT (references `profiles.id`)
  - `viewed_at`: TIMESTAMPTZ
- Table `snap_reactions`:
  - `snap_id`: UUID
  - `user_id`: TEXT
  - `reaction`: TEXT (default 'heart')

### Backend Endpoints (`routes/snapRouter.js` mounted at `/api/snaps`)
1. `POST /api/snaps` — Create snap entry after media upload.
2. `GET /api/snaps/rail` — Get active grouped snaps for feed rail (filtered by visibility + blocks).
3. `GET /api/snaps/user/:userId` — Get active snaps for a specific user's avatar tap.
4. `POST /api/snaps/:id/view` — Mark snap as viewed.
5. `POST /api/snaps/:id/react` — React with heart.
6. `DELETE /api/snaps/:id` — Delete author's own snap.

### Frontend Components
1. `SnapRail.tsx` — Placed above Feed in `app/(tabs)/index.tsx`:
   - "Your Story" circle (`+` if no active story, glowing ring if active).
   - Horizontal scroll of friends/peers with active unviewed stories.
2. `SnapViewer.tsx` — Full-screen modal viewer:
   - Segmented progress bar (timed auto-advance: 5s for images, video duration for videos).
   - Left/Right tap areas to navigate snaps.
   - Header with author info, timestamp, close button.
   - Bottom bar with Heart reaction, comment input, view counter (for owner).
3. `Avatar.tsx` Story Ring Integration:
   - Brand color / gradient border around avatar when `hasActiveStory === true`.
