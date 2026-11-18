# Task List: Profile Page — Facebook Layout Refactor

Tracks `implementation_plans/2026-11-16-profile-facebook-layout.md`.

## Quality Gates Baseline
- [x] Backend tests: 685/685 passing
- [x] TypeScript: `tsc -p frontend/tsconfig.json --noEmit` 0 errors
- [x] Lint: `expo lint` <= 65 errors (65 errors, 127 warnings)
- [x] Vitest: 41/41 passing
- [x] Web build: `expo export --platform web` exit 0

---

## Phase 0 — Baseline Lock (15 min)
- [x] 0.1 Record baseline test and lint counts

## Phase 1 — Backend: Cover Photo, Friends List, Photos List (4h)
- [x] 1.1 Create migration `049_profile_cover.sql` adding `cover_url` to `profiles`
- [x] 1.2 Add `covers` category in `backend/services/filePolicy.js` (public, 5MB, jpg/png/webp)
- [x] 1.3 Add `covers` MIME types and 5MB limit to `frontend/src/lib/upload.ts`
- [x] 1.4 Add `PUT /api/users/me/cover` and `DELETE /api/users/me/cover` routes & controller
- [x] 1.5 Update `userModel.getPublicProfile` to include `cover_url`
- [x] 1.6 Add `GET /api/users/:id/friends` calling `friendModel.listFriends(id, { limit })`
- [x] 1.7 Add `GET /api/users/:id/photos` returning author's image posts
- [x] 1.8 Write tests in `backend/tests/profile-cover.test.js`

## Phase 2 — Extract Components with Zero Visual Change (5h)
- [x] 2.1 Create `frontend/src/components/profile/` directory
- [x] 2.2 Extract `useProfileData` hook from `app/profile/[id].tsx`
- [x] 2.3 Extract `ProfileCover`, `ProfileIdentity`, and `ProfileActions` from existing markup
- [x] 2.4 Extract `ProfileAboutTab`, `ProfilePostsList`, and `ProfileThesesList`
- [x] 2.5 Extract reusable `PostComposer` from `app/(tabs)/index.tsx`
- [x] 2.6 Refactor `app/profile/[id].tsx` into clean composition root
- [x] 2.7 Verify pixel-identical rendering and zero gate regression

## Phase 3 — Desktop Header (5h)
- [x] 3.1 Implement Facebook-style `ProfileCover` (300px desktop, gradient fallback, picker)
- [x] 3.2 Implement `ProfileIdentity` with overlapping 168px avatar, name, friends count, bio, education
- [x] 3.3 Implement `ProfileActions` (Edit Profile, Add Friend, Message, overflow menu)

## Phase 4 — Tabs and Two-Column Body (4h)
- [x] 4.1 Implement `ProfileTabs` (All, About, Friends, Photos, Theses) with active indicator
- [x] 4.2 Set up desktop two-column body layout (360px left cards, flex right feed)
- [x] 4.3 Wire URL query param tab synchronization (`?tab=`)

## Phase 5 — Left Column Cards (5h)
- [x] 5.1 Create shared `ProfileCard` shell component
- [x] 5.2 Implement `ProfileIntroCard` (bio, department, course, year, join date)
- [x] 5.3 Implement `ProfileEducationCard` (department, course, school badge)
- [x] 5.4 Implement `ProfileFriendsCard` (3x3 grid of friends with names, count, link)
- [x] 5.5 Implement `ProfilePhotosCard` (3x3 photo grid, count, link)

## Phase 6 — Right Column Feed (3h)
- [x] 6.1 Integrate `PostComposer` at top of feed for own profile
- [x] 6.2 Render `PostCard` feed with filter header ("Posts", "Filters", "Manage posts")
- [x] 6.3 Ensure infinite scroll and instant post prepending without reload

## Phase 7 — Verification & Review (2h)
- [x] 7.1 Verify all quality gates (tsc 0, lint <= 65, vitest 41, backend 685, web build)
- [ ] 7.2 Manual preview verification with dev server
