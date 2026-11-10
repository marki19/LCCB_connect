# TopBar Menu Popover Route Cleanup — Implementation Plan

## Problem Statement
The Facebook-style Grid Menu Popover in `frontend/src/components/topbar/MenuPopover.tsx` contains outdated and non-existent route paths:
- `/deposit-thesis` (correct route is `/upload-thesis`)
- `/deposit-capstone` (correct route is `/create?type=capstone`)
- `/create-discussion` (correct route is `/create?type=discussion`)
- `/(tabs)/capstones` (correct route is `/(tabs)/search?tab=theses&type=capstone`)
- `/settings` (should trigger `openSettingsSidebar()` via `useSettingsSidebar()` instead of taking over the screen or modal)
- Missing quick links for `Friends` (`/friends`) and `Saved Posts` (`/saved`).

## Proposed Solution
1. Update `SOCIAL_ITEMS` in `MenuPopover.tsx` with corrected routes, add `Friends` and `Saved Posts`.
2. Update `CREATE_ITEMS` in `MenuPopover.tsx` with valid create parameters (`/create?type=capstone`, `/create?type=discussion`, `/upload-thesis`).
3. Connect `useSettingsSidebar()` so clicking "Settings & Privacy" closes the popover and opens the sliding settings drawer.
4. Verify all icons use SVG (`lucide-react-native`).
5. Run TypeScript check via `npx tsc --noEmit`.

