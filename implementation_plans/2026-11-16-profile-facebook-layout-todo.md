# Task List: Profile Page — Facebook Layout Refactor

Tracks `implementation_plans/2026-11-16-profile-facebook-layout.md`.

## Quality Gates Baseline
- [ ] Backend tests: 679/679 passing
- [ ] TypeScript: `tsc -p frontend/tsconfig.json --noEmit` 0 errors
- [ ] Lint: `expo lint` <= 65 errors
- [ ] Vitest: 41/41 passing
- [ ] Web build: `expo export --platform web` exit 0

---

## Phase 0 — Baseline Lock (15 min)
- [ ] 0.1 Record baseline test and lint counts

## Phase 1 — Backend: Cover Photo, Friends List, Photos List (4h)
- [ ] 1.1 Create migration `049_profile_cover.sql` (or next free number) adding `cover_url` to `profiles`
- [ ] 1.2 Add `covers` category in `backend/services/filePolicy.js` (public, 5MB, jpg/png/webp)
- [ ] 1.3 Add `covers` MIME types and 5MB limit to `frontend/src/lib/upload.ts`
- [ ] 1.4 Add `PUT /api/users/me/cover` and `DELETE /api/users/me/cover` routes & controller
- [ ] 1.5 Update `userModel.getPublicProfile` to include `cover_url`
- [ ] 1.6 Add `GET /api/users/:id/friends` calling `friendModel.listFriends(id, { limit })`
- [ ] 1.7 Add `GET /api/users/:id/photos` returning author's image posts
- [ ] 1.8 Write tests in `backend/tests/profile-cover.test.js`

## Phase 2 — Extract Components with Zero Visual Change (5h)
- [ ] 2.1 Create `frontend/src/components/profile/` directory
- [ ] 2.2 Extract `useProfileData` hook from `app/profile/[id].tsx`
- [ ] 2.3 Extract `ProfileCover`, `ProfileIdentity`, and `ProfileActions` from existing markup
- [ ] 2.4 Extract `ProfileAboutTab`, `ProfilePostsList`, and `ProfileThesesList`
- [ ] 2.5 Extract reusable `PostComposer` from `app/(tabs)/index.tsx`
- [ ] 2.6 Refactor `app/profile/[id].tsx` into clean composition root
- [ ] 2.7 Verify pixel-identical rendering and zero gate regression

## Phase 3 — Desktop Header (5h)
- [ ] 3.1 Implement Facebook-style `ProfileCover` (240px desktop, gradient fallback, picker)
- [ ] 3.2 Implement `ProfileIdentity` with overlapping 168px avatar, name, friends count, bio, education
- [ ] 3.3 Implement `ProfileActions` (Edit Profile, Add Friend, Message, overflow menu)

## Phase 4 — Tabs and Two-Column Body (4h)
- [ ] 4.1 Implement `ProfileTabs` (All, About, Friends, Photos, Theses) with active indicator
- [ ] 4.2 Set up desktop two-column body layout (360px left cards, flex right feed)
- [ ] 4.3 Wire URL query param tab synchronization (`?tab=`)

## Phase 5 — Left Column Cards (5h)
- [ ] 5.1 Create shared `ProfileCard` shell component
- [ ] 5.2 Implement `ProfileIntroCard` (bio, department, course, year, join date)
- [ ] 5.3 Implement `ProfileEducationCard` (department, course, school badge)
- [ ] 5.4 Implement `ProfileFriendsCard` (3x3 grid of friends with names, count, link)
- [ ] 5.5 Implement `ProfilePhotosCard` (3x3 photo grid, count, link)

## Phase 6 — Right Column Feed (3h)
- [ ] 6.1 Integrate `PostComposer` at top of feed for own profile
- [ ] 6.2 Render `PostCard` feed with filter header ("Posts", "Filters", "Manage posts")
- [ ] 6.3 Ensure infinite scroll and instant post prepending without reload

## Phase 7 — Verification & Review (2h)
- [ ] 7.1 Verify all quality gates (tsc 0, lint <= 65, vitest 41, backend 679+, web build)
- [ ] 7.2 Manual matrix test: own profile, friend profile, non-friend profile, light & dark mode, desktop & mobile
