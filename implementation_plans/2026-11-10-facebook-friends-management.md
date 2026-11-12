# Facebook-Style Friends Management Page — Implementation Plan

## Goal
Transform `frontend/app/friends.tsx` into a Facebook-style 2-column desktop experience with a responsive card grid for managing friend requests and friends directory.

## Features
1. **Desktop 2-Column Layout (`width >= 768`):**
   - **Left Panel (360px):** Friends navigation (Friend Requests with live badge, Your Friends, Find Friends) + scrollable list.
   - **Right Panel (Flex 1):** Responsive grid of user cards with instant actions.
2. **Facebook-Style Request & Friend Cards:**
   - Card format: Profile avatar, full name, department/course.
   - For Requests: Primary "Confirm" button + secondary "Delete" button.
   - For Friends: Primary "Message" button + secondary "Remove Friend" menu.
3. **Instant Interactive Actions:**
   - Accepting / declining a request immediately updates UI and counters.
   - Starting a chat opens conversation via `openConversation` / `FloatingChatContext`.
4. **SVG Rule Enforcement:**
   - 100% SVG icons (`Users`, `UserPlus`, `UserCheck`, `UserMinus`, `MessageSquare`, `Check`, `X`, `ChevronRight`). Zero emojis.
5. **Mobile View:**
   - Clean responsive segmented control and card list.

