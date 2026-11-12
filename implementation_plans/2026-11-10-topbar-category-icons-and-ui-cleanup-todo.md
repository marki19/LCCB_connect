# Task List: TopBar Category Navigation, Google Avatar Sync, and UI Refinements

## Phase 1: Feed Filter Context & TopBar Category Icons
- [x] **Task 1.1**: Create `frontend/src/contexts/FeedFilterContext.tsx` with `"all" | "websites" | "theses" | "projects" | "discussions"`.
- [x] **Task 1.2**: Update `frontend/src/components/topbar/DesktopTopBar.tsx` with 5 icon-only category tabs.
- [x] **Task 1.3**: Update `frontend/app/(tabs)/index.tsx` to consume filter context, remove body category pills, remove `images` filter, and remove `"0 online · 0 posts"`.
- [x] **Checkpoint 1**: Verify top bar center icons switch feed category without flickering.

## Phase 2: Post Modal Refinements
- [x] **Task 2.1**: In `frontend/app/create.tsx`, remove Lock icon from "Add to your post" toolbar.
- [x] **Task 2.2**: In `frontend/app/create.tsx`, add `outlineStyle: "none"` and `borderWidth: 0` on textarea to remove white outline on web.
- [x] **Checkpoint 2**: Verify create post modal appearance against screenshots.

## Phase 3: Google Profile Photo Defaulting
- [x] **Task 3.1**: In `backend/controllers/authController.js`, extract Google avatar URL from `user.user_metadata` and pass to `createUser`.
- [x] **Task 3.2**: In `backend/controllers/authController.js`, backfill Google avatar if existing user's `avatar_url` is null.
- [x] **Checkpoint 3**: Run backend tests (`npm test`) to ensure auth and login tests continue passing.

## Phase 4: Contacts Sidebar Spacing
- [x] **Task 4.1**: In `frontend/src/components/chat/DesktopContactsRail.tsx`, soften and center the vertical separator between feed and contacts.
- [x] **Checkpoint 4**: Run `npx tsc --noEmit` and verify desktop viewports.
