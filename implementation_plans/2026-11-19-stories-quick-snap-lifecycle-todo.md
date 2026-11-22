# Quick Snap / Stories System — Todo List

- [x] **Phase 1: Backend Data Model & Migration**
  - [x] Write `backend/migrations/059_quick_snap.sql` (`snaps`, `snap_views`, `snap_reactions`, RLS/visibility function).
  - [x] Run migration `npm run db:migrate` and verify tables.
  - [x] Create `backend/models/snapModel.js` with CRUD & active rail query.
  - [x] Create `backend/controllers/snapController.js` with validations.
  - [x] Create `backend/routes/snapRouter.js` and mount on `/api/snaps`.
  - [x] Write backend unit tests in `backend/tests/snaps.test.js`.

- [x] **Phase 2: Frontend API Client & Creation Integration**
  - [x] Create `frontend/src/lib/snaps.ts` with API endpoints (`createSnap`, `getSnapRail`, `viewSnap`, etc.).
  - [x] Update `StoryActionModal.tsx` to call `createSnap` with mediaKey, type, and visibility.
  - [x] Verify creation flow persists a snap record with 24-hour expiration.

- [x] **Phase 3: Frontend Feed Rail & Avatar Rings**
  - [x] Build `frontend/src/components/snaps/SnapRail.tsx` (horizontal scrolling cards).
  - [x] Insert `SnapRail` into `app/(tabs)/index.tsx` above feed posts.
  - [x] Add active story ring styling to `Avatar.tsx` and profile header.

- [x] **Phase 4: Fullscreen Story Viewer**
  - [x] Build `frontend/src/components/snaps/SnapViewer.tsx` (progress bar, tap to advance, close button).
  - [x] Integrate reactions and view counts.
  - [x] Wire story click handlers across feed rail, profile avatar, and inbox avatar.

- [x] **Phase 5: Verification & Quality Gates**
  - [x] `npx tsc --noEmit` -> 0 errors.
  - [x] `npm --prefix frontend test` -> 71+ pass.
  - [x] `node --test backend/tests/snaps.test.js` -> 100% pass.
