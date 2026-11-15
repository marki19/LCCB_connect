# Inline Post Comments Drawer — Implementation Plan

## Goal
Enable users to view, write, and interact with comments directly on the feed beneath any post without full-page navigation, matching Facebook's feed interaction pattern.

## Design & Architecture
1. **Collapsible Inline Drawer in `PostCard.tsx`:**
   - Clicking the "Comment" action button toggles the inline comments section.
   - Smooth expand/collapse animation via `LayoutAnimation` or `Animated`.
2. **Comment Input Composer:**
   - Active user's avatar.
   - Rounded pill input field with placeholder "Write a comment as [Name]…".
   - SVG `Send` button (enabled only when text is non-empty).
   - Optimistic addition to list and immediate counter increment.
3. **Comment List Items:**
   - Avatar of author.
   - Facebook-style chat bubble container with author name (bold), department/role badge, and comment text.
   - Relative timestamp (e.g. "5m", "2h", "1d").
   - Action menu for comment author (Edit, Delete).
4. **SVG Icons Rule Enforcement:**
   - Strictly no emoji icons. All icons use SVG (`MessageCircle`, `Send`, `MoreHorizontal`, `Trash2`, `Edit3`, `CornerDownRight`).

