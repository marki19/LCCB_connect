# Task List: Mobile Navigation, In-Feed Suggestions & Messenger Layout Redesign

## Phase 1: In-Feed Suggestions & Carousel Fixes
- [x] Task 1: Fix `SuggestionCarousel.tsx` card spacing and trailing padding for "See all" card (`frontend/src/components/SuggestionCarousel.tsx`)
- [x] Task 2: Move `SuggestionCarousel` from `ListHeaderComponent` into in-feed insertion after post 2 or 3 (`frontend/app/(tabs)/index.tsx`)

## Phase 2: Top Mobile Header & Drawer Swipe
- [x] Task 3: Remove burger button & theme toggle in `HomeHeader.tsx`, make logo clickable to open sidebar (`frontend/src/components/HomeHeader.tsx`)
- [x] Task 4: Add left-edge swipe gesture detection to open sidebar drawer (`frontend/app/(tabs)/index.tsx`)

## Phase 3: Bottom Navigation Bar Redesign (SVG Icons + Sticky Chats)
- [x] Task 5: Overhaul bottom bar in `frontend/app/(tabs)/_layout.tsx`:
  - 5-tab pattern: Projects, Repositories, Home, Chats, Notifications
  - Replace letter initial text with Lucide SVG icons (`FolderGit2`, `BookOpen`, `Home`, `MessageCircle`, `Bell`)
  - Remove center `+` button
- [x] Task 6: Add `frontend/app/(tabs)/messages.tsx` inside tabs layout so bottom navigation is sticky on Chats

## Phase 4: Messenger-Style Chats Layout
- [x] Task 7: Redesign `InboxPane.tsx` with Facebook Messenger layout (header, search bar, active friend bubbles with note placeholders, conversation rows with online indicators)
- [x] Task 8: Connect active presence data into the story/active bubble row

## Checkpoint & Verification
- [x] Run `npm --prefix frontend test` (38/38 vitest pass)
- [x] Run `npm --prefix frontend run build` (Expo web bundle compiles 0 errors)
