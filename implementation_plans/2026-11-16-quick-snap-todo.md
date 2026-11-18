# Task List: Quick Snap Implementation

Tracked plan: [2026-11-16-quick-snap.md](file:///c:/Programming%20Projects/third-year/LCCB_connect/implementation_plans/2026-11-16-quick-snap.md)

## Baseline Numbers (Phase 0)
- **Backend tests:** 675 pass / 0 fail
- **TypeScript:** 0 errors (`npx tsc -p frontend/tsconfig.json --noEmit`)
- **Expo lint:** 65 errors / 130 warnings
- **Frontend tests:** 41 pass / 7 suites (`npm --prefix frontend test`)
- **Web export:** Clean exit 0 (`dist/index.html`)

---

## Phase 0: Baseline Lock
- [x] Task 0.1: Verify working tree is clean and up to date on `mark1e3`
- [x] Task 0.2: Lock and record five baseline metrics (675 backend / 0 tsc / 65 lint / 41 vitest / clean build)

---

## Phase 1: Foundation: Video Primitive + Storage Category
- [ ] Task 1.1: Install `expo-video` in `frontend/`
- [ ] Task 1.2: Build `frontend/src/components/AppVideo.tsx` using `useVideoPlayer` + `VideoView`
- [ ] Task 1.3: Add `snaps` category rules to `backend/services/filePolicy.js` (jpg/png/webp/mp4/webm, 25MB)
- [ ] Task 1.4: Add `snaps` MIME mapping, size limit, and `captureSnap` / `pickSnap` helpers in `frontend/src/lib/upload.ts`
- [ ] Task 1.5: Extend `backend/tests/filePolicy.test.js` with snaps MIME and rejection tests

### Checkpoint: Phase 1
- [ ] `npx tsc -p frontend/tsconfig.json --noEmit` has 0 errors
- [ ] `filePolicy` tests pass with all rejection cases

---

## Phase 2: Data Layer: Migration 049
- [ ] Task 2.1: Write `backend/migrations/049_quick_snap.sql` (`snaps`, `snap_views`, `snap_comments`, `snap_reactions`, indexes, `visible_snaps()`)
- [ ] Task 2.2: Apply RLS/GRANT hardening and document `visibility='custom'` rejection (HTTP 400)
- [ ] Task 2.3: Run `npm --prefix backend run db:migrate` and verify migration runs cleanly and idempotently
- [ ] Task 2.4: Verify `tests/migrations.test.js` and `tests/schema-init.test.js` pass

### Checkpoint: Phase 2
- [ ] Migration applies twice with 0 errors
- [ ] `visible_snaps()` query verified in PostgreSQL

---

## Phase 3: Backend API
- [ ] Task 3.1: Build `backend/models/snapModel.js` querying through `visible_snaps` and opportunistic `purgeExpired`
- [ ] Task 3.2: Build `backend/controllers/snapController.js` validating key categories, extensions, and caps
- [ ] Task 3.3: Build `backend/routes/snapRouter.js` and mount in `backend/app.js` under auth
- [ ] Task 3.4: Add `snapUploadLimiter` (20/day) and `snapCommentLimiter` (60/hr) in `backend/middleware/actionLimits.js`
- [ ] Task 3.5: Wire notifications for `snap_comment`, `snap_reply`, and `snap_reaction`
- [ ] Task 3.6: Write `backend/tests/snaps.test.js` (visibility matrix, expiry, blocks, views, hearts, comments, cascades)

### Checkpoint: Phase 3
- [ ] All new backend snap tests pass
- [ ] Total backend test count ≥ 675 + new tests, 0 failures

---

## Phase 4: Rail (Feed Integration)
- [ ] Task 4.1: Create `frontend/src/lib/snaps.ts` API client and types
- [ ] Task 4.2: Create `frontend/src/hooks/useSnaps.ts` with rail fetching, refresh, and optimistic state
- [ ] Task 4.3: Create `frontend/src/components/snaps/SnapRail.tsx` using `AppImage` cached thumbnails
- [ ] Task 4.4: Mount `SnapRail` in `frontend/app/(tabs)/index.tsx` above composer
- [ ] Task 4.5: Ensure desktop web renders rail inside center feed column

### Checkpoint: Phase 4
- [ ] Rail thumbnails do not re-fetch on screen/tab switch
- [ ] Feed first paint remains fast and unblocked

---

## Phase 5: Viewer + Engagement
- [ ] Task 5.1: Create `frontend/src/components/snaps/SnapProgress.tsx` (timer for images, `onProgress` for video)
- [ ] Task 5.2: Create `frontend/src/components/snaps/SnapViewer.tsx` (gestures, tap-advance, pause, video onEnd)
- [ ] Task 5.3: Create `frontend/src/components/snaps/SnapCommentSheet.tsx` (nested replies, keyboard avoiding)
- [ ] Task 5.4: Implement optimistic heart toggling and mark-viewed logic on open

### Checkpoint: Phase 5
- [ ] Video snap auto-advances on completion without stalling
- [ ] Viewer opens under 300ms when thumbnail is cached
- [ ] Comments and hearts update without page reload

---

## Phase 6: Composer + History
- [ ] Task 6.1: Build `frontend/app/snap/create.tsx` (Camera + Gallery entries, preview, caption, VisibilityPicker)
- [ ] Task 6.2: Enforce client-side guards (≤30s video, ≤25MB) before upload
- [ ] Task 6.3: Build `frontend/app/snaps.tsx` (Active + Expired history tabs, seen count, delete)
- [ ] Task 6.4: Wire entry points (long-press own rail circle, profile row)

### Checkpoint: Phase 6
- [ ] Camera snap publishes to rail immediately
- [ ] Over-duration video rejected client-side before network upload
- [ ] Expired snaps display without media

---

## Phase 7: Post Video Attachments
- [ ] Task 7.1: Write `backend/migrations/050_post_video.sql` (add `video_url` column, update type constraint)
- [ ] Task 7.2: Update `frontend/app/create.tsx` for video uploads (50MB cap, mutual exclusivity with images)
- [ ] Task 7.3: Update `frontend/src/components/PostCard.tsx` and `PostImageGallery.tsx` with `AppVideo`
- [ ] Task 7.4: Update `frontend/app/post/[id].tsx` with full-width video player
- [ ] Task 7.5: Update `frontend/src/lib/api.ts` `adaptPost` to resolve `video_url`

### Checkpoint: Phase 7
- [ ] mp4 uploads and plays smoothly on web and mobile post cards
- [ ] Mixed image + video post attempt cleanly rejected

---

## Phase 8: Moderation, Limits, Cleanup
- [ ] Task 8.1: Add `snap` target to report system and `reportRouter.js`
- [ ] Task 8.2: Wire moderation hide actions to set `moderation_status='hidden'`
- [ ] Task 8.3: Verify rate limits with automated test cases
- [ ] Task 8.4: Verify opportunistic expiry purge on rail load
- [ ] Task 8.5: Document Cloudflare R2 1-day lifecycle rule for `snaps/`

### Checkpoint: Phase 8
- [ ] Hidden snap is filtered from all feeds and rail
- [ ] 21st snap in 24h triggers 429 rate limit response

---

## Phase 9: Verification and Release
- [ ] Task 9.1: Run `npm --prefix backend test` (pass count ≥ 675 + new tests)
- [ ] Task 9.2: Run `npx tsc -p frontend/tsconfig.json --noEmit` (0 errors)
- [ ] Task 9.3: Run `npx expo lint` in `frontend/` (errors ≤ 65)
- [ ] Task 9.4: Run `npm --prefix frontend test` (41+ tests passing)
- [ ] Task 9.5: Run `npm --prefix frontend run build` (clean `dist/index.html` output)
- [ ] Task 9.6: Run manual verification matrix on mobile and desktop web
- [ ] Task 9.7: Review git status and prepare deployment push command

### Checkpoint: Phase 9
- [ ] All five quality gates pass at or better than baseline
- [ ] Ready for user `git push origin mark1e3`
