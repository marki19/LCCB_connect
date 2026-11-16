# Task List: Facebook Desktop UX Refactor

## Slice 1: Profile Navigation Fixes
- [x] Task 1: Update `DesktopLeftRail.tsx` to route directly to `/profile/${profile.id}`
- [x] Task 2: Update `AccountPopover.tsx` to route directly to `/profile/${profile.id}`
- [x] Task 3: Make `SettingsSidebar.tsx` user row pressable to route to `/profile/${profile.id}`
- [x] Task 4: Add auto-redirect to `/profile/${currentUser.id}` in `app/(tabs)/profile.tsx`

## Slice 2: Facebook-Style Messenger Layout
- [x] Task 5: Update `DesktopLayout.tsx` to hide side rails and grant full width on `messages` tab
- [x] Task 6: Remove duplicate topbar and double top margin in `app/(tabs)/messages.tsx`
- [x] Task 7: Polish `MessagesSplit.tsx` and `InboxPane.tsx` to match Facebook desktop layout

## Slice 3: Facebook-Style Friends Hub
- [x] Task 8: Add suggestions fetching and Suggestions tab in `app/friends.tsx`
- [x] Task 9: Render "People You May Know" card grid when requests are empty or tab selected

## Slice 4: Verification
- [x] Task 10: Run TypeScript checks, vitest, and web export build
