# Facebook-Style Floating Mini-Chat Window Implementation Plan

**Goal:** Implement a Facebook-style desktop floating mini-chat window docked at the bottom-right of the screen so users can chat with classmates without leaving the feed.

---

## 1. Architecture Overview

### Context: `FloatingChatContext.tsx`
- State:
  - `activeChat`: `{ conversationId?: string; peerId: string; peerName?: string; avatarUrl?: string } | null`
  - `isMinimized`: boolean (toggle to compact bottom pill or full window)
- Methods:
  - `openChat(params: { conversationId?: string; peerId: string; peerName?: string; avatarUrl?: string })`
  - `closeChat()`
  - `minimizeChat()`
  - `maximizeChat()` (expand to full page `/messages/[id]`)

### Component: `FloatingChatWindow.tsx`
- **Docked Position**: Fixed at `bottom: 0, right: 20`, width `330px`, height `450px`, `zIndex: 1050`.
- **Card**: Elevated rounded top corners (`borderTopLeftRadius: 12`, `borderTopRightRadius: 12`), `colors.surface`, 1px `colors.border`.
- **Header**:
  - Peer Avatar with live presence indicator dot (`usePresence()`).
  - Peer Name and active status subtitle.
  - Controls: Maximize icon (opens `/messages/[id]`), Minimize (`-`), Close (`X`).
- **Body**:
  - Realtime conversation using `useConversationRealtime(conversationId)`.
  - Chat bubbles with seen/delivered ticks and typing indicator.
- **Footer**:
  - Input field with Enter-to-send support on web.
  - Send button.

### Integration
- Mount in `DesktopLayout.tsx` for all desktop web views.
- Update `ChatsPopover.tsx` to call `openChat` instead of navigating away.
- Update `DesktopLayout` sidebar peers to call `openChat`.

