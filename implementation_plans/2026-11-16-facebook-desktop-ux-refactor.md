# Facebook-Style Desktop UX Refactor Plan

## Context & Objectives
User identified three specific UX issues on desktop web compared to Facebook's design:
1. **Profile Navigation**: Clicking profile in the left rail or account popover was routing to the degraded `/(tabs)/profile` stub instead of the full Facebook-style profile page (`/profile/[id]`).
2. **Messages Layout**: Messages tab was squished inside a 760px center feed column between DesktopLeftRail and DesktopContactsRail with a duplicate TopBar, resulting in an awkward 4-column layout instead of Facebook's full-width 2-pane Messenger layout.
3. **Friends Layout**: Friends screen was showing an empty black void ("No Pending Requests") instead of Facebook's rich card grid with friend requests and "People You May Know" suggestions.

## Implementation Steps
1. **Profile Navigation**:
   - `frontend/src/components/leftrail/DesktopLeftRail.tsx`: Route to `/profile/${profile.id}`.
   - `frontend/src/components/topbar/AccountPopover.tsx`: Route to `/profile/${profile.id}`.
   - `frontend/src/components/SettingsSidebar.tsx`: Add pressable header to route to `/profile/${profile.id}`.
   - `frontend/app/(tabs)/profile.tsx`: Add redirect to `/profile/${currentUser.id}` for authenticated users.

2. **Facebook-Style Messenger**:
   - `frontend/src/components/DesktopLayout.tsx`: When `activeTabName === "messages"`, hide left rail and contacts rail, remove center column padding and `maxWidth: 760` constraint to make Messenger span full width under the TopBar.
   - `frontend/app/(tabs)/messages.tsx`: Remove redundant duplicate `<DesktopTopBar />` and double `marginTop: TOP_BAR_HEIGHT`.
   - `frontend/src/components/messages/MessagesSplit.tsx`: Polish layout and empty state to match Facebook's "No chats selected".
   - `frontend/src/components/messages/InboxPane.tsx`: Refine chats header and tab filters for desktop Messenger feel.

3. **Facebook-Style Friends Hub**:
   - `frontend/app/friends.tsx`: Fetch friend suggestions (`/api/friends/suggestions`), add Suggestions sidebar tab, and render the responsive card grid with "People You May Know" when requests are empty or on Suggestions tab.

## Verification
- TypeScript check: `npx tsc -p frontend/tsconfig.json --noEmit`
- Linter: `npm --prefix frontend run lint`
- Vitest: `npm --prefix frontend test`
- Web export: `npm --prefix frontend run build`
