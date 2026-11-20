# Implementation Plan: Mobile Facebook Messenger Screen & Desktop Sidebar Layout

## 1. Problem Statement
The user requested:
1. "messages should look like this on mobile": Facebook Messenger mobile interface with:
   - Authentic header with bold "messenger" title and new chat action.
   - Meta AI / Search Messenger pill with search and grid icons.
   - Horizontal Stories & Notes carousel: "Create story" (user avatar with `+` badge and speech bubble note) + active friends (avatars with green online/recent badges, speech bubble notes, and first names).
   - Polished conversation rows: 54px avatars with active indicators, "You: ..." message snippets, timestamps, unread indicators.
   - Fix bug where `activeId === undefined` prevented the stories carousel from displaying on mobile.
   - Seamless handling of message requests.
2. "for desktop just stretch it but maintain the sidebars so it will not look so much stretched":
   - Previously `isMessages` stripped out both `DesktopLeftRail` and `DesktopContactsRail`, making the messages pane stretch across the entire screen (1920px).
   - Retain both sidebars (`DesktopLeftRail` and `DesktopContactsRail`) on desktop for Messages.
   - The center messaging view stretches to fill the space cleanly between the sidebars.

## 2. Proposed Changes
### Desktop Layout
- `frontend/src/components/DesktopLayout.tsx`:
  - Keep `showLeftSidebar` active on Messages.
  - Keep right sidebar (`DesktopContactsRail` on `width >= 1200`) active on Messages.
  - Set center column styling so `MessagesSplit` stretches across the center column between the two rails without unnecessary padding.
- `frontend/app/messages/[id].tsx`:
  - On desktop (`isSplit`), redirect to `/(tabs)/messages?id=${id}` so deep links retain desktop layout and sidebars.
- `frontend/app/(tabs)/messages.tsx`:
  - Read optional query param `id` and pass `initialId` to `MessagesSplit`.

### Mobile Messenger & InboxPane
- `frontend/src/components/messages/InboxPane.tsx`:
  - Replace title with bold lowercase "messenger" logo style.
  - Add search bar with Meta AI placeholder and grid icon.
  - Fix stories rail condition: show when `tab === "chats"` and `(!activeId || !isSplit)`.
  - Enhance "Create story" item with user's note bubble, `+` button badge, and tapping actions.
  - Enhance friend items with online/recent presence badge, `peer.note` speech bubble, and tap-to-chat.
  - Format conversation row snippets with "You: ..." prefix and unread indicators.
  - Ensure message request rows correctly invoke `onSelect` and navigate to thread.

### Verification
- Run TypeScript check: `node frontend/node_modules/typescript/bin/tsc --project frontend/tsconfig.json --noEmit` (0 errors).
- Run Vitest tests: `npm --prefix frontend test -- --run` (41/41 passing).
- Run Backend tests: `npm --prefix backend test` (691/691 passing).
- Run Web export build: `npm --prefix frontend run build` (clean export to `dist`).
