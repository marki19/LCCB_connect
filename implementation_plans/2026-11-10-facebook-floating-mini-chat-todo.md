# Task List: Facebook-Style Floating Mini-Chat Window

Tracks implementation of `implementation_plans/2026-11-10-facebook-floating-mini-chat.md`.

## Tasks

- [x] Task 1: Create `FloatingChatContext.tsx` with `openChat`, `closeChat`, `toggleMinimize` state management.
- [x] Task 2: Build `FloatingChatWindow.tsx` with header controls, realtime message thread (`useConversationRealtime`), and input composer.
- [x] Task 3: Wrap `RootLayout` in `frontend/app/_layout.tsx` with `FloatingChatProvider`.
- [x] Task 4: Integrate `FloatingChatWindow` into `DesktopLayout.tsx`.
- [x] Task 5: Wire `ChatsPopover.tsx` and sidebar peer clicks to open the floating mini-chat on desktop.
- [x] Task 6: Verification and testing.
