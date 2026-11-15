# Task List: Saved Posts, Settings Sidebar, and Real Multi-Entity Search Engine

## Phase 1: Database Foundation & Migration
- [x] Task 1.1: Create `backend/migrations/031_saved_posts_and_search_indexes.sql` with `saved_posts` table, RLS, and GIN FTS/Trigram indexes
- [x] Checkpoint: Verify migration SQL syntax and structure

## Phase 2: Backend Models & API Endpoints
- [x] Task 2.1: Implement `backend/models/savedPostModel.js` and `backend/controllers/savedPostController.js` (Save, Unsave, List)
- [x] Task 2.2: Mount saved post routes in `backend/routes/postRouter.js` and update `postModel.js` with `is_saved` flag
- [x] Task 2.3: Implement `backend/models/searchModel.js` with multi-entity FTS + Trigram query logic
- [x] Task 2.4: Implement `backend/controllers/searchController.js` and `backend/routes/searchRouter.js`, mounted in `backend/app.js`
- [x] Task 2.5: Write automated backend tests: `backend/tests/savedPosts.test.js` & `backend/tests/search.test.js`
- [x] Checkpoint: Automated backend test suite passes cleanly (383/383 passed)

## Phase 3: Settings Sidebar Integration
- [x] Task 3.1: Create `frontend/src/contexts/SettingsSidebarContext.tsx`
- [x] Task 3.2: Update `frontend/src/components/SettingsSidebar.tsx` to handle functional actions and clean dismiss
- [x] Task 3.3: Mount `SettingsSidebar` at layout root in `frontend/src/components/DesktopLayout.tsx` and `frontend/app/_layout.tsx`
- [x] Task 3.4: Wire `DesktopLeftRail.tsx` and `AccountPopover.tsx` "Settings & Privacy" buttons to open sidebar
- [x] Checkpoint: Opening settings opens sidebar drawer smoothly without full screen or 404 errors

## Phase 4: Saved Posts UI & Flow
- [x] Task 4.1: Add `savePost`, `unsavePost`, `getSavedPosts` in `frontend/src/lib/api.ts`
- [x] Task 4.2: Add Bookmark SVG action and optimistic toggle in `PostCard.tsx` and `PostMenu.tsx`
- [x] Task 4.3: Create `frontend/app/saved.tsx` with saved posts feed and unsave action
- [x] Task 4.4: Wire `DesktopLeftRail.tsx` "Saved Posts" shortcut to navigate to `/saved`
- [x] Checkpoint: Post bookmarking, `/saved` feed, and unsaving work end-to-end

## Phase 5: Search Engine UI & Topbar Live Search
- [x] Task 5.1: Add `searchEverything` and `searchSuggestions` in `frontend/src/lib/api.ts`
- [x] Task 5.2: Overhaul `frontend/app/(tabs)/search.tsx` into a multi-tab search hub (All, People, Posts, Papers)
- [x] Task 5.3: Wire the search pill in `DesktopTopBar.tsx` with live typing, suggestions, and Enter to search
- [x] Task 5.4: Review and verify zero mockups remain across all audited components
- [x] Task 5.5: Audit all icons for strict SVG rule compliance (no emojis)
- [x] Final Checkpoint: Full end-to-end verification complete (0 TS errors, 383/383 backend tests passing)
