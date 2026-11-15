# Task List: Facebook-Style Top Bar & Expandable Popovers

Tracks implementation of `implementation_plans/2026-11-10-facebook-topbar-popovers.md`.

## Tasks

- [x] Task 1: Create `DesktopTopBar.tsx` with logo, search pill, center tabs, and 4 circular action buttons.
- [x] Task 2: Build `MenuPopover.tsx` (Menu & Create dropdown with campus shortcuts and creation actions).
- [x] Task 3: Build `ChatsPopover.tsx` (Messenger dropdown with conversation items, live presence, unread dots, search).
- [x] Task 4: Build `NotificationsPopover.tsx` (Recent notifications dropdown with read/unread statuses).
- [x] Task 5: Build `AccountPopover.tsx` (Profile preview card, theme toggle, console link, settings, logout).
- [x] Task 6: Integrate top bar into `DesktopLayout.tsx` with backdrop dismiss and `marginTop: 56` on sidebar/center.
- [x] Task 7: Center navigation transformed from text tabs to custom crafted SVG icons (`HomeNavIcon`, `RepositoryNavIcon`, `CapstonesNavIcon`, `DiscussionsNavIcon`) with active solid/outline states.
- [x] Task 8: Simplified `_layout.tsx` by removing legacy unused rails and disabling the permanent right messages sidebar in favor of the Messenger top bar popover.
