# Implementation Plan: TopBar Category Navigation, Google Avatar Sync, and UI Refinements

## Overview
Implement 6 UI/UX refinements requested by the user:
1. **TopBar Icon-Only Category Navigation**: Migrate feed category filtering (`all`, `websites`, `theses`, `projects`, `discussions`) directly into the TopBar center navigation as clean, icon-only buttons with active indicators. Remove the redundant `images` filter (discussions support images natively) and remove the feed body category pills.
2. **Remove Public Online/Post Stats**: Remove `"0 online · 0 posts"` counter from the campus feed header.
3. **Remove "Lock" Attachment Icon**: Strip the Lock icon from the "Add to your post" composer toolbar in `create.tsx` (audience privacy is already managed via the dropdown at the top).
4. **Remove White Focus Outline in Post Modal**: Eliminate the browser focus outline (`outlineStyle: "none"`) on the `TextInput` in `create.tsx`.
5. **Default Profile Photo from Google**: Set Google account photo (`user_metadata.avatar_url` / `picture`) as the initial profile picture upon Google sign-in if `profiles.avatar_url` is unset, without overriding subsequent custom avatar uploads in the app.
6. **Contacts Sidebar Separator Spacing**: Soften and reposition the vertical separator line of `DesktopContactsRail` with balanced margin and subtle divider color so it sits centered between the feed and contacts.

---

## User Review Required
> [!IMPORTANT]
> - **TopBar Center Navigation Shift**: The top bar center icons will now directly switch feed categories (`All`, `Websites`, `Theses`, `Projects`, `Discussions`) using URL params (`/?feed=<category>`) and state synchronization. Clicking an icon instantly filters the feed without page flicker or navigation disruption.
> - **Images Category Removal**: The standalone `images` category is removed per request; image posts are categorized as general feed discussions with multi-image previews.

---

## Proposed Changes

### 1. Feed Category Context & TopBar Center Icons
#### [NEW] `frontend/src/contexts/FeedFilterContext.tsx`
- Shared context managing active category filter: `"all" | "websites" | "theses" | "projects" | "discussions"`.
- Syncs with URL search param `?feed=` and allows any component (TopBar or feed) to read and change active category.

#### [MODIFY] `frontend/src/components/topbar/DesktopTopBar.tsx`
- Replace `NAV_TABS` with category filter tabs:
  - `all`: Sparkles / Home icon (`All`)
  - `websites`: Globe icon (`Websites`)
  - `theses`: BookOpen / Manuscript icon (`Theses`)
  - `projects`: FolderGit2 icon (`Projects`)
  - `discussions`: MessageSquare icon (`Discussions`)
- Render icon-only with tooltips (`title` on web) and active bottom indicator line.
- On click: if on home feed, update filter state directly without re-rendering the layout; if on another page, navigate to `/(tabs)/?feed=<category>`.

#### [MODIFY] `frontend/app/(tabs)/index.tsx`
- Consume `useFeedFilter()`.
- Remove category pills row (`All`, `Websites`, `Theses`, `Projects`, `Discussions`, `Images`) from the feed body.
- Retain the academic department and course filter pills.
- Remove `images` from `FilterValue`.
- Remove `"0 online · 0 posts"` text.

---

### 2. Post Modal Cleanup in `frontend/app/create.tsx`
#### [MODIFY] `frontend/app/create.tsx`
- Remove the Lock icon button from the "Add to your post" toolbar.
- Add `outlineStyle: "none"`, `outlineWidth: 0`, and `borderWidth: 0` to main `TextInput` to remove the white focus border on web.

---

### 3. Google Profile Photo Defaulting
#### [MODIFY] `backend/controllers/authController.js`
- In `googleAuth`:
  - Extract `avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null`.
  - Pass `avatar_url: avatarUrl` into `userModel.createUser`.
  - If profile exists but `profile.avatar_url` is null/empty and Google provides an avatar, update `profiles.avatar_url`.
- Retain existing ability for users to upload custom avatars via `/api/users/profile/avatar`, which will not be overwritten by Google logins once set.

---

### 4. Right Contacts Sidebar Styling
#### [MODIFY] `frontend/src/components/chat/DesktopContactsRail.tsx`
- Adjust `borderLeftColor` to a softer token (`colors.border` with lower opacity or subtle margin).
- Add `marginLeft: 16` and `paddingLeft: 12` to center the separation between the feed card edge and contacts content.

---

## Verification Plan

### Automated Tests
1. Backend unit tests:
   ```bash
   cd backend
   npm test
   ```
   All 409+ tests must pass.
2. Frontend TypeScript check:
   ```bash
   cd frontend
   npx tsc --noEmit
   ```
   Must exit code 0 with 0 errors.

### Manual Verification
1. **TopBar Category Icons**:
   - Click each icon (All, Websites, Theses, Projects, Discussions) in top bar center.
   - Confirm feed filters immediately without screen flickering.
   - Confirm "Images" option is completely removed.
2. **Stats Removal**:
   - Confirm `"0 online · 0 posts"` is no longer visible on the feed.
3. **Post Composer**:
   - Open Create Post modal (`/create` or composer trigger).
   - Verify textarea has no harsh white border.
   - Verify "Add to your post" has 4 icons (Image, Project, Capstone, Website) and NO Lock icon.
4. **Contacts Rail**:
   - Verify the vertical divider has breathing space and sits comfortably between feed and contacts.

