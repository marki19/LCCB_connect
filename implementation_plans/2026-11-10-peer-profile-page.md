# Peer Profile Page (`/profile/[id]`) — Implementation Plan

## Problem Statement
When a user clicks on an author name, search result, or friend in the application, the client navigates to `/profile/[id]`. Currently, this file does not exist, causing 404 errors or missing screen warnings. Furthermore, `GET /api/users/:id` is restricted to self/admin to prevent probing private dossier fields (student_id, phone, email, totp_secret).

## Solution Architecture
1. **Backend Profile Endpoint (`GET /api/users/:id/profile`)**:
   - Secure parameterized query returning only sanitized public metadata (`id`, `full_name`, `username`, `avatar_url`, `bio`, `department_name`, `course_name`, `year_level`, `role`, `skills`, `created_at`).
   - Mutual block check: if blocked in either direction, returns 404.
   - Dynamic friendship status check with caller (`friend`, `pending_out`, `pending_in`, `none`).
   - Real aggregation counts for `posts_count` (bounded by `visible_posts`), `theses_count` (bounded by `visible_theses`), and `friends_count`.
2. **Backend Unit Tests**:
   - Test self profile, peer profile, blocked profile (404), non-existent user (404), and friendship status mapping.
3. **Frontend API Helper**:
   - `getUserProfile(userId: string)` in `frontend/src/lib/api.ts`.
4. **Frontend Screen (`frontend/app/profile/[id].tsx`)**:
   - Desktop and Mobile responsive Facebook-style profile view.
   - Banner & Avatar with Presence indicator and Verified status badge.
   - Action buttons:
     - Own profile: "Edit Profile" (modal).
     - Peer profile: "Message", and contextual friend button ("Add Friend", "Accept Request", "Request Sent", "Friends").
   - Profile tabs:
     - "Posts": Paginated list of user's posts via `GET /api/posts?author_id=:id` rendered with `PostCard`.
     - "Theses": Paginated list of user's deposited theses via `GET /api/theses?uploader_id=:id`.
     - "About": Detailed academic information (Department, Program, Year Level, Bio, Skills, Joined date).
   - Zero emojis: all icons use SVG (`lucide-react-native`).

