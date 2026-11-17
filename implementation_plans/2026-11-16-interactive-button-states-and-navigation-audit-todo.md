# Task List: Interactive Button States & Navigation Route Audit

## Phase 1: Core UI Button States
- [x] Task 1: Update `Button.tsx` (`Button` & `IconButton`) with web `cursor: pointer`, hover background, and active press scale feedback (`frontend/src/components/ui/Button.tsx`)

## Phase 2: Navigation Bars Interactive States & Routing
- [x] Task 2: Enhance `DesktopTopBar.tsx` (`TopBarButton`, `navTab`, brand logo, avatar button) with hover, pressed scale, pointer cursor, and home redirect (`frontend/src/components/topbar/DesktopTopBar.tsx`)
- [x] Task 3: Enhance `MobileTabBar` in `_layout.tsx` and `HomeHeader.tsx` with pressed scaling, pointer cursor, and update legacy `/messages` route to `/(tabs)/messages` (`frontend/app/(tabs)/_layout.tsx`, `frontend/src/components/HomeHeader.tsx`)

## Phase 3: Popovers, Rails, and Sidebar Audit
- [x] Task 4: Fix dead links and add hover/press states in `SettingsSidebar.tsx` (wire Notifications, Messages, About LCCB, Report an issue) (`frontend/src/components/SettingsSidebar.tsx`)
- [x] Task 5: Enhance `MenuPopover.tsx`, `DesktopLeftRail.tsx`, and `DesktopContactsRail.tsx` with hover/press states and update `/messages` to `/(tabs)/messages`

## Phase 4: In-Feed, Suggestion Carousel, and Messenger Feedbacks
- [x] Task 6: Enhance Feed Composer buttons in `frontend/app/(tabs)/index.tsx` and `SuggestionCarousel.tsx` cards/pills with hover, press scale, and pointer cursor
- [x] Task 7: Enhance Messenger `InboxPane.tsx` (stories, chat rows, tab pills) with hover, press scale, and pointer cursor (`frontend/src/components/messages/InboxPane.tsx`)

## Phase 5: Verification & Quality Gates
- [x] Task 8: Run type check, test suite, and web build (`npx tsc`, `npm test`, `npm run build`)
