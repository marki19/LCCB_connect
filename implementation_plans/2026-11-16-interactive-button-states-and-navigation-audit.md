# Implementation Plan: Interactive Button States & Navigation Route Audit

## Problem Statement
The user requested:
1. "for all buttons that is clicked. add a while on hover/while pressing states. also add cliked state."
2. "review everything, ensure all buttons work and directing/redirecting to its proper screen page."

Currently:
- Many pressables across desktop and mobile lack `cursor: pointer` on web, resulting in standard arrow cursors instead of hand pointers.
- Several core components (`IconButton`, `MenuItem`, `itemRow`, `navTab`, `addPill`, `tabPill`) do not have tactile press animations (`transform: [{ scale }]`) or active/hover styling.
- Navigation route audit revealed dead and legacy redirects:
  - `SettingsSidebar.tsx`: "Notifications" has no `onPress` at all; "About LCCB" and "Report an issue" have no `onPress`; "Messages" routes to `/messages` instead of direct `/(tabs)/messages`.
  - `MenuPopover.tsx`: "Messages" routes to `/messages` instead of direct `/(tabs)/messages`.
  - `DesktopLeftRail.tsx`: "Messages" routes to `/messages` instead of direct `/(tabs)/messages`.
  - `HomeHeader.tsx`: "Messages" routes to `/messages` instead of direct `/(tabs)/messages`.

## Architecture & Implementation Strategy

### 1. Universal Interactive States (Hover, Press, Active Click)
- Standardize tactile feedback:
  - **Buttons & IconButtons** (`Button.tsx`):
    - Web `cursor: "pointer"` (or `"not-allowed"` when disabled/loading).
    - Hover background transitions.
    - Active press scale: `transform: [{ scale: pressed ? 0.97 : 1 }]` for standard buttons, and `0.93` for icon buttons.
    - Active background highlight.
  - **Navigation Bars**:
    - `DesktopTopBar.tsx`: TopBarButton (menu, chats, notifs, account) with hover background, press scale (`0.93`), cursor pointer. Category tabs with hover overlay, press scale (`0.96`), and cursor pointer. Logo click with router push to home.
    - `MobileTabBar` (`app/(tabs)/_layout.tsx`): Press scale (`0.92`), cursor pointer, touch opacity.
    - `HomeHeader.tsx`: Press scale (`0.94`), cursor pointer, brand logo press scale (`0.97`).
  - **Sidebar & Rails**:
    - `SettingsSidebar.tsx`: `MenuItem` with cursor pointer, hover background (`panelInset`), pressed background (`hoverOverlay`), and pressed scale (`0.98`).
    - `DesktopLeftRail.tsx`: `itemRow` with cursor pointer, hover & pressed background (`surfaceSunken`), and pressed scale (`0.98`).
    - `DesktopContactsRail.tsx`: `contactRow` with cursor pointer, hover overlay, and pressed scale (`0.98`).
  - **Feed & In-Feed Components**:
    - `index.tsx`: Feed composer action buttons (`Project`, `Capstone`, `Photo`, `Discuss`) and composer input pill with cursor pointer, hover overlay, and pressed scale (`0.95`).
    - `SuggestionCarousel.tsx`: Cards, "Add" button pill, and "See all" card with cursor pointer, hover tint, and pressed scale (`0.95` - `0.98`).
    - `PostCard.tsx`: Web cursor pointer and touch feedback for like, comment, share, bookmark, and author rows.
  - **Messenger Inbox**:
    - `InboxPane.tsx`: Story bubbles, conversation rows, search bar, and "Chats" / "Requests" tab pills with cursor pointer, hover overlay, and active press scale (`0.95` - `0.98`).

### 2. Navigation Route Audit & Dead Link Elimination
- `SettingsSidebar.tsx`:
  - Wire `Notifications` to `go("/(tabs)/notifications")`.
  - Wire `Messages` to `go("/(tabs)/messages")`.
  - Wire `About LCCB` to `Linking.openURL("https://lccbonline.edu.ph")`.
  - Wire `Report an issue` to trigger issue report dialog / contact modal.
- `MenuPopover.tsx`:
  - Update `Messages` href from `/messages` to `/(tabs)/messages`.
- `DesktopLeftRail.tsx`:
  - Update `Messages` route from `/messages` to `/(tabs)/messages`.
- `HomeHeader.tsx`:
  - Update `Messages` route from `/messages` to `/(tabs)/messages`.

### 3. Verification & Quality Gates
- TypeScript type checking: `npx tsc -p frontend/tsconfig.json --noEmit` must pass with 0 errors.
- Vitest suite: `npm --prefix frontend test` must pass (38/38).
- Web export bundle: `npm --prefix frontend run build` must compile without errors.
- Backend tests: `npm --prefix backend test` must remain 675/675 passing.
