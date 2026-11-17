# Mobile Navigation, Feed Flow, and Messenger-Style UI Redesign

## Overview
This plan implements five key UX and UI improvements across mobile and desktop interfaces:
1. **In-Feed Friend Suggestions**: Move "People you may know" from the fixed top header down into the news feed (rendered between posts, e.g., after 2-3 posts), and fix the clipped/broken "See all" card at the end of the carousel.
2. **Bottom Navigation Overhaul**: Replace letter placeholders (`H`, `R`, `N`, `P`) with clean SVG icons (`lucide-react-native`). Replace the center `+` button with **Chats**. Update the 5-tab pattern to: **Projects, Repositories, Home, Chats, Notifications**.
3. **Clean Mobile Top Header**: Remove the dark/light mode toggle and burger menu button. Make the LCCB Connect logo clickable to open the sidebar drawer, and support swiping from the left screen edge to reveal the drawer.
4. **Messenger-Style Chat Layout**: Redesign the Inbox view into a modern Messenger experience:
   - Header with bold title and compose icon.
   - Search bar.
   - Active Friends / 24h Stories & Notes carousel row at top (active green status dot, user story bubble with `+`, note bubble above avatar).
   - Conversation list below with active status badges, unread styling, and last-message snippets.
5. **Sticky Persistent Bottom Bar**: Ensure the bottom navigation bar is sticky and always visible on primary screens, including the Chats screen, by bringing Chats into the `(tabs)` router structure.

---

## Architecture & Component Map

```
frontend/app/(tabs)/
├── _layout.tsx           <-- 5 Tab Navigation: Projects, Repositories, Home, Chats, Notifications (with SVG icons)
├── capstones.tsx         <-- Tab 1: Projects (visible, tab bar sticky)
├── search.tsx            <-- Tab 2: Repositories (visible, tab bar sticky)
├── index.tsx             <-- Tab 3: Home (contains in-feed suggestions between posts + swipe-to-open drawer)
├── messages.tsx          <-- Tab 4: Chats (new Messenger-style layout with active friends + sticky tab bar)
└── notifications.tsx     <-- Tab 5: Notifications (visible, tab bar sticky)

frontend/src/components/
├── HomeHeader.tsx        <-- Clickable logo for drawer; remove burger menu and top theme toggle
├── SuggestionCarousel.tsx<-- Fix trailing "See all" card clipping and width calculation
└── messages/
    └── InboxPane.tsx     <-- Messenger-style UI (Search, active bubble row, story/notes placeholders)
```

---

## Vertical Slices & Tasks

### Phase 1: Feed Polish & In-Feed Suggestions
- **Task 1**: Fix `SuggestionCarousel.tsx` layout and end padding so the "See all" card renders completely without horizontal clipping or distortion.
- **Task 2**: Move `SuggestionCarousel` from `ListHeaderComponent` in `frontend/app/(tabs)/index.tsx` into the feed items, inserting it naturally after the 2nd or 3rd post.

### Phase 2: Top Mobile Header & Drawer Gesture
- **Task 3**: Refactor `HomeHeader.tsx`:
  - Remove the hamburger button (`AlignJustify`).
  - Wrap the LCCB Connect logo in a `Pressable` that triggers `onMenuPress`.
  - Remove the top theme switch button.
- **Task 4**: Add edge-swipe gesture support on `frontend/app/(tabs)/index.tsx` (swiping from left screen edge to right opens `SettingsSidebar`).

### Phase 3: Bottom Navigation Bar Redesign
- **Task 5**: Update `frontend/app/(tabs)/_layout.tsx`:
  - Change tabs to: `capstones` (Projects), `search` (Repositories), `index` (Home), `messages` (Chats), `notifications` (Notifications).
  - Replace text initial placeholders with Lucide SVG icons (`FolderGit2`, `BookOpen`, `Home`, `MessageCircle`, `Bell`).
  - Support active indicator styling, badges, and guest filtering.
- **Task 6**: Route `frontend/app/(tabs)/messages.tsx` to display `InboxPane`, so the bottom navigation bar remains sticky and persistent on Chats.

### Phase 4: Messenger-Style Chats Layout
- **Task 7**: Redesign `InboxPane.tsx` with Facebook Messenger layout:
  - Header: Bold "Chats" title + new conversation compose button.
  - Search bar input.
  - Active users / stories horizontal row: "Your story" with `+` icon, active friend avatars with green status badges, and note bubbles.
  - Conversation list: larger circular avatars with active indicators, bold unread text, timestamp, and message snippets.
- **Task 8**: Wire presence data from `usePresence()` into the active friends story row so live online classmates appear at the top.

---

## Verification & Testing Plan
1. **Frontend Tests**: Run `npm --prefix frontend test` (vitest unit test suite).
2. **Web Bundle Build**: Run `npm --prefix frontend run build` (`npx expo export --platform web`) to ensure all route and component changes compile with 0 errors.
3. **Manual / Visual Verification**:
   - Verify bottom navigation bar has 5 SVG icons and no letters.
   - Verify Chats screen displays the sticky bottom bar.
   - Verify "People you may know" appears inside the scrolling feed, not pinned at the top.
   - Verify "See all" card is fully visible without clipping.
   - Verify clicking the logo or swiping from left opens the sidebar drawer.
   - Verify Messenger-style active friend bubbles and conversation list render cleanly.
