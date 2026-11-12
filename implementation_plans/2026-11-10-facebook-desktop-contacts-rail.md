# Facebook-Style Desktop Contacts Right Rail Implementation Plan

**Goal:** Implement a Facebook-style desktop "Contacts" right rail on wide screens (`width >= 1200px`) showing online peers and friends with live presence dots, one-click floating chat launch, and quick filter search.

---

## 1. Architecture Overview

### Component: `DesktopContactsRail.tsx` (`frontend/src/components/chat/DesktopContactsRail.tsx`)
- **Condition**: Rendered on desktop web when `width >= 1200px` and user is signed in (`!isGuest`).
- **Placement**: Fixed or right-aligned 260px column.
- **Header**:
  - Title: "Contacts"
  - Action icons: Search toggle (`Search`), Options (`MoreHorizontal`).
  - Optional inline search input when expanded.
- **List Items**:
  - Filtered / sorted with online peers at the top.
  - Avatar with real-time presence indicator dot (`usePresence()`).
  - Peer Name.
  - Hover highlight effect (`colors.hoverOverlay`).
  - On click: calls `openChat({ peerId, peerName, avatarUrl })` to launch the docked floating mini-chat.

### Integration in `DesktopLayout.tsx`
- Mount `DesktopContactsRail` beside the center feed when `width >= 1200`.
- Keep center column centered and responsive across screen sizes.

