# Implementation Plan: Facebook-Style Saved Posts, Search Fixes, and TopBar Routes

## Overview
Address four critical issues reported from testing:
1. **Search Engine 500 Error**: `searchModel.js` crashed because of mismatched PostgreSQL column names (`pr.verified_status`, `p.like_count`, `p.comment_count`, `p.repost_count`, `t.keywords`).
2. **TopBar Unmatched Routes**: Center nav tabs for Capstones (`/(tabs)/capstones`) and Discussions (`/(tabs)/discussions`) have no route handlers, triggering Expo "unmatched route" errors.
3. **Saved Posts Left Sidebar Shift**: `saved.tsx` centered its whole layout container with `justifyContent: "center"`, causing the left sidebar to float away from the screen edge on desktop.
4. **Facebook-Style Saved Items UI & Filter**: Overhaul `/saved` to match the Facebook desktop layout shown in the user's reference image (`media_1794310307834_8cf18e23.jpg`): dedicated Saved Left Rail (Saved Items, My Collections, Create Collection), Filter popover dropdown (All, Posts, Photos, Capstones, Links), and horizontal Facebook saved card format with "Add to Collection", Share, and Unsave actions.

---

## User Review Required
> [!IMPORTANT]
> - **TopBar Center Navigation**: The two center icons (mortarboard and chat bubbles) will now route to `/(tabs)/capstones` and `/(tabs)/discussions`. On mobile, these remain accessible via the app routes and search tabs, keeping the 4-tab mobile bottom bar clean.
> - **Saved Posts Layout**: Following Facebook's design, navigating to `/saved` replaces the generic home shortcuts rail with the dedicated "Saved" sidebar (header, Saved Items, Collections list, Create Collection button), docked firmly at the left edge (`left: 0`).

---

## Proposed Changes

### 1. Backend: Search Engine Column Fixes
#### [MODIFY] `backend/models/searchModel.js`
- In `searchPeople`:
  - Replace `pr.verified_status` with `pr.verification_status`.
  - Update `ORDER BY` to use `pr.verification_status DESC`.
- In `searchPosts`:
  - Replace `p.like_count` with `COALESCE((SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id), 0) AS likes`.
  - Replace `p.comment_count` with `COALESCE((SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id AND c.moderation_status != 'hidden'), 0) AS comments`.
  - Replace `p.repost_count` with `COALESCE((SELECT COUNT(*)::int FROM reposts r WHERE r.original_post_id = p.id), 0) AS repost_count`.
  - Replace `pr.verified_status` in author JSON with `pr.verification_status`.
- In `searchTheses`:
  - Remove `t.keywords` (does not exist in `theses` table).
  - Use `t.department_name` via `LEFT JOIN departments d ON d.id = pr.department_id`.
- Update `backend/tests/search.test.js` to assert the corrected fields.

---

### 2. Frontend: TopBar Route Handlers
#### [NEW] `frontend/app/(tabs)/capstones.tsx`
- Dedicated Academic Capstones & Thesis Explorer screen.
- Features:
  - Header with capstone icon, search input, and Department filter pills (College of Computer Studies, Business, Arts & Sciences, Nursing).
  - Degree level toggles ("All", "Undergraduate Capstone", "Graduate Dissertation").
  - Capstone research cards with abstract teaser, authors, department badge, and "View Manuscript" PDF action.

#### [NEW] `frontend/app/(tabs)/discussions.tsx`
- Dedicated Campus Discussions & Q&A Forum screen.
- Features:
  - Header with discussion icon, search, and topic filter pills.
  - "Ask a Question / Start Discussion" prompt button.
  - Feed of discussion posts (`type: "discussion"` or posts with question tags) with comment counters and upvotes.

#### [MODIFY] `frontend/app/(tabs)/_layout.tsx`
- Register `capstones` and `discussions` as `<Tabs.Screen />` entries.
- Set `options={{ href: null }}` on mobile so they don't crowd the 4-item mobile tab bar, while responding properly to `router.push("/(tabs)/capstones")` and `router.push("/(tabs)/discussions")` from desktop top bar and links.

---

### 3. Backend: Saved Collections & Items Filtering
#### [NEW] `backend/migrations/034_saved_collections.sql`
- Create `saved_collections` table:
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
  - `name text NOT NULL`
  - `is_private boolean DEFAULT true`
  - `created_at timestamptz DEFAULT now()`
- Create `saved_collection_items` table:
  - `collection_id uuid REFERENCES saved_collections(id) ON DELETE CASCADE`
  - `post_id uuid REFERENCES posts(id) ON DELETE CASCADE`
  - `created_at timestamptz DEFAULT now()`
  - `PRIMARY KEY (collection_id, post_id)`
- RLS policies ensuring users can only manage their own collections.

#### [NEW] `backend/models/savedCollectionModel.js` & `backend/controllers/savedCollectionController.js`
- `listCollections(userId)`: returns collections with item counts and cover thumbnail.
- `createCollection(userId, name, isPrivate)`: creates a new collection.
- `addItemToCollection(userId, collectionId, postId)`
- `removeItemFromCollection(userId, collectionId, postId)`

#### [MODIFY] `backend/routes/postRouter.js`
- Mount `/saved/collections` routes.

---

### 4. Frontend: Facebook-Style Saved Posts Screen
#### [MODIFY] `frontend/app/saved.tsx`
- **Layout Architecture**:
  - Replace the centered layout with a fixed two-column Facebook structure:
    - **Left Column**: `SavedLeftRail` (width 360px on desktop, docked at `left: 0`, full height below top bar).
    - **Right Column**: Main Saved Feed (`flex: 1`, max-width 880px, padding horizontal 32px, margin top 24px).
- **Left Column Components (`SavedLeftRail`)**:
  - Header: Title "Saved" (24px bold) + Settings gear button.
  - "Saved Items" primary navigation item (blue bookmark icon, active selection background pill).
  - Divider.
  - "My collections" section header.
  - Collection items list with padlock "Only me" and collection item count.
  - "+ Create new collection" action button opening collection creation modal.
- **Center Header & Filter Popover**:
  - Title displaying active filter ("All", "Posts", "Photos", "Research Papers", or collection name).
  - Filter button with sliders icon (`SlidersHorizontal`).
  - Popover dropdown with category filters:
    - "All" (with checkmark when active)
    - "Posts"
    - "Photos / Media"
    - "Research Papers / Capstones"
    - "Links"
- **Horizontal Facebook Saved Cards**:
  - Left thumbnail (110x110 square, rounded corners, displaying post photo or academic doc thumbnail).
  - Content details:
    - Post title / excerpt (bold, 15px).
    - Subtitle (`color: textTertiary`): "Post • [Time ago] • [Department name]".
    - Author row: small 20px avatar + "Saved from [Author Name]'s post" (linking to `/profile/[id]`).
    - Action buttons row:
      - "Add to Collection" pill button.
      - Share icon button.
      - More options (`...`) button with Unsave and Copy Link actions.

---

## Verification Plan

### Automated Tests
1. Backend test suite:
   ```bash
   cd backend
   npm test
   ```
   Verify all 403 existing tests continue to pass, plus new tests for `searchModel` and `savedCollectionModel`.
2. Frontend TypeScript build:
   ```bash
   cd frontend
   npx tsc --noEmit
   ```
   Must exit with code 0.

### Manual Verification
1. **Search Engine**:
   - Type queries in TopBar search pill (e.g. "student", "computer", "capstone").
   - Confirm typeahead dropdown returns suggestions without 500 error.
   - Press Enter or click "See all results", navigate to `/search`, test All / People / Posts / Repository tabs.
2. **TopBar Routes**:
   - Click Capstones icon in top bar -> loads `/(tabs)/capstones` without "unmatched route".
   - Click Discussions icon in top bar -> loads `/(tabs)/discussions` without "unmatched route".
3. **Saved Posts Page**:
   - Click "Saved Posts" from Left Rail or Menu Popover.
   - Confirm left sidebar stays anchored to `left: 0` (no horizontal shifting/jumping).
   - Verify layout matches Facebook screenshot (`media_1794310307834_8cf18e23.jpg`).
   - Test Filter button dropdown and click between All, Posts, Photos, and Research Papers.
   - Test "Add to Collection" and "Unsave" on saved cards.

