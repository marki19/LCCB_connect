# Implementation Plan: Inbox Header Navigation, Chat Retention, P2P Friends & Messages, and Department Post Privacy

## Overview
This plan addresses the full set of user requirements:
1. **Inbox Header & Back Navigation**: On desktop, `/messages` and `/messages/[id]` lacked `DesktopTopBar` and a back button, trapping users in the inbox view.
2. **Chat Retention & Persistent Sessions**: Conversations with admins and peers appeared to vanish after sessions because `ChatsPopover` and `DesktopLayout` queried `/friends` instead of `/conversations`, `canMessage` routed admin chats to "requested" instead of "direct", `getOrCreateConversation` lacked peer data, and `ThreadPane` lacked a single-conversation fetch endpoint (`GET /api/conversations/:id`).
3. **Peer-to-Peer Friend Requests (Both Ways)**: Fix broken endpoint call in `PeerPicker.tsx` (`POST /friends` 404 vs `POST /friends/requests`), alias routes in `friendRouter.js`, and verify symmetric send/receive/accept/decline between both accounts.
4. **Department Pill Bar Removal & Privacy Enforcement**: Remove the department pill filter bar from the feed header (`frontend/app/(tabs)/index.tsx`) and add `'department'` as a first-class content visibility option across database (`visible_posts()`), API schemas, and composers so that department-scoped posts and interactions are strictly hidden from users outside that department.

---

## User Review Required

> [!IMPORTANT]
> - All chats (admin messages, peer conversations) will persist across sessions in `ChatsPopover` (top bar), `MessagesSidebar` (desktop rail), and `/messages` (inbox), loading from PostgreSQL `/conversations`.
> - Friend requests will work symmetrically between any two accounts from `PeerPicker`, profile pages, and the Friends screen.
> - The department filter pill bar in the home feed (`All Depts`, `CCS`, `TD_...`) is removed.
> - A new visibility option **"My Department"** is added to the post composer, ensuring only peers in the same department can view or interact with it.

---

## Architecture & Implementation Slices

### Slice 1: Inbox Header & Desktop Back Navigation
- Render `DesktopTopBar` at the top of `frontend/app/messages/index.tsx` and `frontend/app/messages/[id].tsx` on desktop (`width >= 768`).
- Offset the split messaging layout with `marginTop: TOP_BAR_HEIGHT`.
- Pass `showBack={true}` and `onBack={() => safeBack("/(tabs)")}` to `InboxPane` on desktop, rendering an intuitive back arrow right beside the "Inbox Messages" title.

### Slice 2: Peer-to-Peer Friend Requests (Both Ways)
- **Backend Route Aliasing (`backend/routes/friendRouter.js`)**:
  - Add `router.post("/", ...)` as an alias to `friendController.createRequest` alongside `router.post("/requests", ...)`.
- **Frontend `PeerPicker.tsx`**:
  - Switch `handleAdd` to use `sendFriendRequest(peer.id)` from `src/lib/messages.ts` (targeting `/friends/requests`).
- **Symmetric Verification**:
  - Verify Account A -> Account B request creates incoming request for B and outgoing for A.
  - Verify Account B accept creates accepted friendship visible in both accounts' `/friends`.

### Slice 3: Chat Retention & Admin Direct Messaging
- **Backend API (`backend/routes/conversationRouter.js` & `backend/controllers/messageController.js`)**:
  - Add `GET /api/conversations/:id` endpoint returning the conversation with full `peer` object, last message, and unread count.
  - Update `getOrCreateConversation` in `backend/models/messageModel.js` to return `peer` object using `CONVERSATION_SELECT`.
  - Update `canMessage` in `backend/models/messageModel.js`: If sender or recipient role is `admin` or `superadmin`, always resolve the decision to `"direct"` so admin chats are active immediately and never hidden as requests.
  - In `messageModel.listConversations`: Keep conversations with or without messages visible, sorted by `COALESCE(last_message_at, created_at) DESC`.
- **Frontend Top Bar & Sidebar**:
  - Update `frontend/src/components/topbar/ChatsPopover.tsx` to call `listConversations()` (`/conversations`) instead of `/friends?limit=20`, so all active chats (admin, staff, peers) remain in the top bar dropdown regardless of online status or friendship state.
  - In `frontend/src/components/DesktopLayout.tsx` (`MessagesSidebar`), load real conversation history via `listConversations()`.
  - In `frontend/src/components/messages/ThreadPane.tsx`, fetch `GET /api/conversations/:id` when deep-linking rather than failing back to "Conversation" "Offline".

### Slice 4: Department Filter Removal & Post Privacy Scoping
- **Feed UI (`frontend/app/(tabs)/index.tsx`)**:
  - Remove the department filter pills (`All Depts`, `CCS`, `TD_...`) above the feed.
- **Database & Backend Visibility**:
  - Add migration `036_department_post_visibility.sql`:
    ```sql
    ALTER TYPE public.content_visibility ADD VALUE IF NOT EXISTS 'department';
    ```
  - Update `public.visible_posts(viewer text)` and `public.visible_theses(viewer text)` to check:
    ```sql
    OR (
      p.visibility = 'department'
      AND EXISTS (
        SELECT 1 FROM public.profiles viewer_pr
        WHERE viewer_pr.id = viewer
          AND viewer_pr.department_id IS NOT NULL
          AND viewer_pr.department_id = p.author_department_id
      )
    )
    ```
  - Update `backend/validation/index.js` to include `"department"` in `Visibility`.
  - Update `backend/models/postModel.js` to support `'department'` in `getAllPosts` and verify post visibility in `toggleLike`.
- **Frontend Post Composer**:
  - Update `frontend/src/types.ts` and `frontend/src/components/VisibilityPicker.tsx` to include `"department"` ("My Department" with `Building2` icon).
  - Update `create.tsx`, `post-settings.tsx`, and `upload-thesis.tsx` with the new visibility option.

---

## Verification Plan

### Automated Tests
1. **TypeScript Typecheck**:
   - `cd frontend && npx tsc --noEmit` must pass with 0 errors.
2. **Backend Unit & Integration Tests**:
   - `cd backend && npm test` must pass.

### Manual Verification
1. **Inbox Desktop Navigation**:
   - Open `/messages` on desktop web: verify `DesktopTopBar` renders, and clicking the Back arrow returns to `/(tabs)`.
2. **P2P Friends & Chat Persistence**:
   - Account A sends friend request to Account B via `PeerPicker` and profile: verify Account B receives request and accepts it.
   - Account A and B chat: verify conversation appears in top bar `ChatsPopover`, `MessagesSidebar`, and `/messages`.
   - Refresh browser / end session: verify conversation remains in the list with full message history and correct peer name.
3. **Department Filter Removal & Post Privacy**:
   - Open `/` (home feed): verify the department pills are removed.
   - Post with "My Department": verify users in the same department see the post, while users in other departments do not see it or interact with it.
   - Post with "Public": verify users in all departments see the post.
