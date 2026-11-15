# Task List: Facebook-Style Saved Posts, Search Fixes, and TopBar Routes

## Phase 1: Search Engine Bug Fixes
- [x] **Task 1.1**: Fix PostgreSQL column names in `backend/models/searchModel.js` (`verification_status`, likes/comments/repost subqueries, remove `t.keywords`).
- [x] **Task 1.2**: Update unit tests in `backend/tests/search.test.js` to assert corrected field structures.
- [x] **Checkpoint 1**: Verify `backend/models/searchModel.js` with live node queries; run `npm test` to confirm all search tests pass.

## Phase 2: TopBar Route Handlers (`/capstones` and `/discussions`)
- [x] **Task 2.1**: Create `frontend/app/(tabs)/capstones.tsx` with dedicated academic capstone browsing, department filters, and manuscript cards.
- [x] **Task 2.2**: Create `frontend/app/(tabs)/discussions.tsx` with campus discussions feed and Q&A prompt.
- [x] **Task 2.3**: Register `capstones` and `discussions` in `frontend/app/(tabs)/_layout.tsx` so router matches both routes with 0 errors.
- [x] **Checkpoint 2**: Run `npx tsc --noEmit`; confirm clicking both top bar icons routes properly without "unmatched route".

## Phase 3: Facebook-Style Saved Posts Redesign
- [x] **Task 3.1**: Create `backend/migrations/034_saved_collections.sql`, `backend/models/savedCollectionModel.js`, `backend/controllers/savedCollectionController.js`, and mount `/api/posts/saved/collections`.
- [x] **Task 3.2**: Create `SavedLeftRail` in `frontend/app/saved.tsx` with Facebook-styled header, "Saved Items" active pill, and "My collections" section.
- [x] **Task 3.3**: Implement Facebook-styled filter popover dropdown (`SlidersHorizontal` trigger with All, Posts, Photos, Capstones, Links options).
- [x] **Task 3.4**: Implement Facebook-styled horizontal saved cards with media thumbnail, post excerpt, "Saved from [Author]'s post" link, "Add to Collection", Share, and Unsave actions.
- [x] **Task 3.5**: Fix layout anchoring so left rail is pinned to `left: 0` without moving or jumping on wide screens.
- [x] **Checkpoint 3**: Verify `/saved` UI against reference screenshot `media_1794310307834_8cf18e23.jpg`.

## Phase 4: Final Verification
- [x] **Task 4.1**: Run full backend test suite (`cd backend; npm test`) — all 409 tests pass.
- [x] **Task 4.2**: Run full frontend TypeScript check (`cd frontend; npx tsc --noEmit`) — 0 errors.
