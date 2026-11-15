# Facebook-Style Top Bar & Expandable Popovers Implementation Plan

**Goal:** Implement the Facebook-style desktop top navigation bar with the 4 right-aligned circular action icons and expandable floating dropdown popovers (Grid Menu, Messenger, Notifications, Account).

---

## 1. Architecture Overview

### Top Bar Component (`DesktopTopBar.tsx`)
- **Placement**: Fixed across the entire top of desktop viewports (`Platform.OS === 'web' && width >= 768`), height 56px.
- **Left**: LCCB Connect Logo + Quick Search pill input.
- **Center**: Primary navigation tabs (Feed, Repository, Capstones, Discussions) with active blue indicator line.
- **Right (The 4 Action Icons)**:
  1. **Menu Icon** (`LayoutGrid`, 40x40 circular button): Expands the **Menu & Create Popover**.
  2. **Messenger Icon** (`MessageCircle` / Messenger SVG, 40x40 circular button): Displays unread badge counter; expands the **Chats Popover**.
  3. **Notifications Icon** (`Bell`, 40x40 circular button): Displays unread notification count; expands the **Notifications Popover**.
  4. **Account Icon** (User Avatar circle with small dropdown caret): Expands the **Account & Settings Popover**.

---

## 2. Popovers Specification

### Popover 1: Menu & Create Popover (`MenuPopover.tsx`)
- **Dimensions**: Width ~560px, anchored beneath the Grid button (`top: 56`, `right: 16`).
- **Left Column ("Campus & Social")**:
  - Campus Feed (`/(tabs)/`)
  - Thesis Repository (`/(tabs)/search`)
  - Capstones & Projects (`filter=projects`)
  - Friends & Campus Directory (`/friends`)
  - Messages (`/messages`)
- **Right Column ("Create")**:
  - Share a Post (`/create?type=text`)
  - Deposit Thesis (`/upload-thesis`)
  - Share Capstone/Project (`/create?type=project`)
  - Start Discussion (`/create?type=discussion`)

### Popover 2: Chats Popover (`ChatsPopover.tsx`)
- **Dimensions**: Width ~360px, max-height 520px, anchored beneath the Messenger icon (`top: 56`, `right: 64`).
- **Header**: "Chats", options button, and "New Message" pencil button (opens `PeerPicker`).
- **Search Input**: "Search conversations...".
- **List Items**:
  - Peer Avatar with live presence indicator dot (online/offline).
  - Peer Name, last message snippet, timestamp (`timeAgo`).
  - Unread blue dot indicator.
  - Tapping an item navigates directly to `/messages/[id]`.
- **Footer**: "See all in Messages" (`/messages`).

### Popover 3: Notifications Popover (`NotificationsPopover.tsx`)
- **Dimensions**: Width ~360px, max-height 520px, anchored beneath the Bell icon (`top: 56`, `right: 112`).
- **Header**: "Notifications" + "Mark all as read".
- **List Items**:
  - Notification icon or actor avatar.
  - Title and relative timestamp.
  - Read vs unread styling.
- **Footer**: "See all notifications" (`/(tabs)/notifications`).

### Popover 4: Account & Settings Popover (`AccountPopover.tsx`)
- **Dimensions**: Width ~320px, anchored beneath the Avatar icon (`top: 56`, `right: 16`).
- **Profile Card**:
  - Avatar, full name, department/year level, and "See your profile" link.
- **Quick Links**:
  - Admin Console / Moderation Console (if privileged role).
  - Theme Toggle: Dark / Light mode with current state indicator.
  - Settings & Privacy (`/settings`).
  - Log Out button with confirmation.

---

## 3. Layout Integration (`DesktopLayout.tsx`)

1. **Top Bar Insertion**:
   - On desktop web (`width >= 768`), render `DesktopTopBar` at the top of the viewport.
   - Adjust `DesktopLayout` content padding (`paddingTop: 56px`).
2. **Remove Always-Open Right Sidebar**:
   - Replace the permanent 360px right sidebar with the on-demand `ChatsPopover`.
   - Result: Center feed has clean, generous space (~760px) and matches Facebook's exact desktop layout.
3. **Backdrop & Dismissal Engine**:
   - Single active state: `type PopoverType = 'menu' | 'chats' | 'notifications' | 'account' | null`.
   - Transparent full-screen pressable backdrop closes any open popover on outside click or `Escape` key press.

---

## 4. Phased Implementation Tasks

### Phase 1: Header Shell & Circular Action Buttons
- [ ] Create `frontend/src/components/topbar/DesktopTopBar.tsx`.
- [ ] Implement the 4 circular icon buttons with hover effects, active state styling, and unread badges.

### Phase 2: Popover Base & Dropdowns
- [ ] Create `frontend/src/components/topbar/MenuPopover.tsx` (Social shortcuts + Create actions).
- [ ] Create `frontend/src/components/topbar/ChatsPopover.tsx` (reusing conversation fetching and active peers from `DesktopLayout`).
- [ ] Create `frontend/src/components/topbar/NotificationsPopover.tsx`.
- [ ] Create `frontend/src/components/topbar/AccountPopover.tsx`.

### Phase 3: DesktopLayout Integration & Polish
- [ ] Integrate `DesktopTopBar` and popovers into `DesktopLayout.tsx`.
- [ ] Retune desktop layout widths and verify responsiveness.
- [ ] Run test suite (`npm test`) and type check (`npx tsc --noEmit`).

