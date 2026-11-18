# Profile Page — Facebook Layout Refactor

**Date:** 2026-11-16
**Branch:** `mark1e3`
**Screen:** `app/profile/[id].tsx` (942 lines today)
**Status:** awaiting approval

---

## 1. Goal

Rebuild the desktop profile page to match the reference screenshot: full-bleed cover photo, avatar overlapping its bottom edge, name and stats block, a tab strip, then a two-column body — profile cards on the left, composer and posts on the right.

Mobile keeps its current single-column layout. The screenshot is a desktop composition and the app already branches on `isDesktop` at `app/profile/[id].tsx:651`.

---

## 2. Correction to my earlier review

I reported that `/profile/[id]` loses the desktop left rail. **That was wrong.** `app/profile/[id].tsx:650-656` renders its own `DesktopTopBar` and `DesktopLeftRail`:

```tsx
<DesktopTopBar />
<View style={[styles.desktopBody, { marginTop: TOP_BAR_HEIGHT }]}>
  <View style={styles.leftRailWrapper}><DesktopLeftRail /></View>
  <View style={styles.feedColumn}>{mainScroll}</View>
  <View style={styles.rightSpacer} />
```

The rail is present. Only `/friends` genuinely lacks it — `app/friends.tsx` renders `DesktopTopBar` at line 300 but never `DesktopLeftRail`.

---

## 3. What exists vs what is missing

**Already available**

| Need | Source |
|---|---|
| Name, bio, department, course, year level | `UserProfileData` in `src/lib/api.ts` |
| `stats.friends_count`, `stats.posts_count`, `stats.theses_count` | same |
| Friendship state (`friend` / `pending_out` / `pending_in` / `none`) | same |
| Avatar upload + removal | `PUT /api/users/:id`, `DELETE /api/users/me/avatar` |
| Friends of *any* user | `friendModel.listFriends(userId, { limit })` — already takes an id, only the route is missing |
| Posts by author | `GET /api/posts?author_id=:id` |
| Image rendering with stable cache keys | `AppImage` |
| Post card | `PostCard` |
| Avatar | `Avatar` |

**Missing**

1. **Cover photo.** No `cover_url` on `profiles` (`backend/schema.sql`), no storage category, no upload endpoint.
2. **Friends grid data.** `GET /api/friends` returns only the caller's friends; there is no `GET /api/users/:id/friends`.
3. **Photos grid data.** No endpoint returning just a user's image posts.
4. **A reusable composer.** The "What's on your mind?" block is inline in `app/(tabs)/index.tsx:470-560`; there is no component to reuse on the profile.
5. **Any profile subcomponent.** `src/components/profile/` does not exist.

---

## 4. Decisions

1. **Desktop only.** Mobile keeps today's layout. One `isDesktop` branch already exists; the new composition replaces only the desktop return.
2. **Cover photo gets its own storage category `covers`** — public, 5 MB, jpg/png/webp. `avatars` stays 2 MB and means avatars; a cover is a different size class and a different key prefix.
3. **Tabs become: All · About · Friends · Photos · Theses.** The screenshot shows All/About/Friends/Photos/Reels/More. Reels has no data (no video feed yet); More has nothing behind it. Theses stays — it is LCCB-specific and already built.
4. **Do not invent profile fields.** The screenshot's "Personal details" (relationship status, gender), "Contact info", and "Highlights" have no columns behind them. Showing empty cards is worse than showing none. Left column ships with Intro, Education, Friends, Photos.
5. **Extract, don't duplicate.** The composer moves out of `index.tsx` into `src/components/PostComposer.tsx` before the profile uses it. Copy-pasting a 90-line composer would be bolting on.
6. **Split the file before restyling it.** `profile/[id].tsx` is 942 lines. Restyling in place makes the diff unreviewable. Phase 2 extracts components with zero visual change, then Phase 3+ changes appearance.
7. **Migration numbering.** Quick Snap's plan claims `049_quick_snap.sql`. Whichever lands first takes 049; the other shifts by one. Note it in both task files rather than guessing.

---

## 5. Target component architecture

```
frontend/src/components/profile/
  ProfileCover.tsx          cover image, "Add cover photo" (own profile only)
  ProfileIdentity.tsx       avatar overlapping cover, name, friends count, bio, education
  ProfileActions.tsx        Edit profile / Add friend / Message / overflow menu
  ProfileTabs.tsx           All · About · Friends · Photos · Theses
  ProfileIntroCard.tsx      bio, department, course, year level
  ProfileEducationCard.tsx  department + course
  ProfileFriendsCard.tsx    9-avatar grid, "See all friends"
  ProfilePhotosCard.tsx     9-photo grid, "See all photos"
  ProfileAboutTab.tsx       existing About content, moved out
  useProfileData.ts         profile + posts + friends + photos fetch, one hook

frontend/src/components/PostComposer.tsx   extracted from (tabs)/index.tsx
```

`app/profile/[id].tsx` becomes a composition root: fetch through the hook, choose desktop or mobile, render.

---

## 6. Phases

### Phase 0 — Baseline (15 min)

Already recorded on 2026-11-16 and independently verified:

| Gate | Value |
|---|---|
| Backend tests | 675 / 675 |
| `tsc --noEmit` | 0 errors |
| `expo lint` | 65 errors / 130 warnings |
| `vitest` | 41 / 41 |
| Web export | clean |

**Acceptance:** re-run and confirm these five before touching anything.

---

### Phase 1 — Backend: cover photo, friends list, photos list (4h)

**Files:** `backend/migrations/049_profile_cover.sql` (or next free number), `services/filePolicy.js`, `models/userModel.js`, `controllers/userController.js`, `routes/userRouter.js`, `tests/profile-cover.test.js`

**Tasks**

1. Migration: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;`
2. `filePolicy.js`: add `covers` to `CATEGORIES` and `PUBLIC_CATEGORIES`; rules `{ maxBytes: 5MB, allowedExtensions: [".jpg",".jpeg",".png",".webp"], allowedMimes: [image/jpeg, image/png, image/webp] }`. `EXTENSION_MIME` already covers these.
3. `upload.ts` (frontend): `BUCKET_MIME_TYPES.covers`, `MAX_UPLOAD_BYTES.cover = 5MB`.
4. `PUT /api/users/me/cover` — body `{ cover_url }`, validates with `parseKey()` and requires `category === 'covers'`, sets the column, deletes the previous object best-effort. Mirrors the avatar flow in `721e010`.
5. `DELETE /api/users/me/cover` — nulls the column, mirrors `DELETE /api/users/me/avatar`.
6. `userModel.getPublicProfile` — add `cover_url` to the projection.
7. `GET /api/users/:id/friends?limit=` — new controller method calling `friendModel.listFriends(id, { limit })`. Respect the same visibility rule as the profile itself (404 for a blocked or suspended user).
8. `GET /api/users/:id/photos?limit=` — image posts by author, newest first, filtered to rows with a non-empty `image_urls` or `image_url`.
9. Tests: cover upload rejects a 6 MB buffer and a non-`covers` key; friends endpoint returns the right list for a third party; photos endpoint returns only image posts; a blocked viewer gets 404.

**Acceptance**
- `npm --prefix backend test` green, count above 675.
- `curl` a cover upload end to end against the dev database.

---

### Phase 2 — Extract components, zero visual change (5h)

**Goal:** make Phase 3 a small diff. Nothing on screen moves.

**Tasks**

1. Create `src/components/profile/` and move the header JSX (`profile/[id].tsx:267-487`) into `ProfileCover`, `ProfileIdentity`, `ProfileActions` with the current markup.
2. Move the About tab (`:577-645`) into `ProfileAboutTab`.
3. Move the posts and theses tab renderers (`:492-575`) into `ProfilePostsList` and `ProfileThesesList`.
4. Extract `useProfileData(id)` from the fetch effects (`:86-150`) — profile, posts, theses, plus loading and error flags.
5. Extract `PostComposer` from `app/(tabs)/index.tsx:470-560` into `src/components/PostComposer.tsx`; `index.tsx` imports it. No prop changes beyond what the extraction requires.
6. `profile/[id].tsx` becomes the composition root.

**Acceptance**
- `tsc` 0 errors, `expo lint` still 65 errors, `vitest` 41/41.
- Pixel-compare before/after at 1280 px wide: no visual difference.
- `(tabs)/index.tsx` renders identically after the composer extraction.

**Why this phase exists:** a 942-line file cannot take a layout rewrite and stay reviewable. Extracting first means Phase 3 is a diff of styling, not a diff of everything.

---

### Phase 3 — Desktop header (5h)

**Tasks**

1. `ProfileCover.tsx`
   - Full-width of the center column, height 240 px (200 px under 1100 px wide).
   - `AppImage` with `contentFit="cover"`, `cover_url` resolved through `resolveFileUrl`.
   - No cover: a gradient placeholder using `colors.surfaceSunken` — not an empty grey box.
   - Own profile only: "Add cover photo" pill bottom-right, opens the picker, uploads to `covers`, `PUT /api/users/me/cover`.
   - Non-own profile: no control.
2. `ProfileIdentity.tsx`
   - Avatar 168 px, `marginTop: -84px` so it overlaps the cover, 4 px white ring.
   - Name at 32 px/700, then `{friends_count} friends` on one line.
   - Bio one line, truncated with ellipsis; empty bio renders nothing.
   - Education line: `{course_name || department_name}` + " · LCCB". Renders nothing when both are null.
3. `ProfileActions.tsx`
   - Own: "Edit profile" (primary), overflow menu (share, copy link).
   - Other: "Add friend" / "Friends" / "Respond to request" driven by `friendship`, plus "Message".
   - All buttons reuse `Button` so hover and press states come from `03538b2`.

**Acceptance**
- Cover, overlap, and identity render at 768, 1024, and 1440 px.
- A profile with no bio, no course, and no cover still looks intentional.
- "Add cover photo" round-trips and the new cover survives a reload.

---

### Phase 4 — Tabs and two-column body (4h)

**Tasks**

1. `ProfileTabs.tsx` — All · About · Friends · Photos · Theses, coral underline on the active tab, horizontal scroll under 900 px. Reuse the tab styling from `friends.tsx`'s desktop menu so the app has one tab idiom.
2. Desktop body: `flexDirection: "row"`, left column fixed 360 px, right column flexible with `maxWidth: 680`.
3. Keep `DesktopTopBar` and `DesktopLeftRail` exactly as they are today.
4. All tab = left cards + right feed. About / Friends / Photos / Theses tabs render full-width single column, no left cards.
5. Tab state lives in the URL (`?tab=`) so a refresh keeps the tab and links are shareable.

**Acceptance**
- Switching tabs does not refetch the profile.
- Deep link `/profile/<id>?tab=photos` opens the Photos tab.
- No layout shift when the posts list loads.

---

### Phase 5 — Left column cards (5h)

**Tasks**

1. `ProfileIntroCard` — bio, department, course, year level, joined date (`created_at`). Each row hidden when null. One pencil icon, own profile only, linking to `/edit-profile`.
2. `ProfileEducationCard` — department and course with a graduation-cap icon. Hidden entirely when both are null.
3. `ProfileFriendsCard` — 3×3 avatar grid from `GET /api/users/:id/friends?limit=9`, count in the header, "See all friends" → `/friends`. Hidden when the count is 0 and it is not your own profile.
4. `ProfilePhotosCard` — 3×3 grid of image posts from `GET /api/users/:id/photos?limit=9`, "See all photos" switches to the Photos tab. Hidden when empty.
5. Cards share one `ProfileCard` shell (title, optional action, padding) so spacing and borders are consistent.

**Acceptance**
- A user with no friends and no photos sees Intro + Education only, with no empty boxes.
- Grids use `AppImage`, so switching tabs and returning makes zero image requests.

---

### Phase 6 — Right column (3h)

**Tasks**

1. Own profile: `PostComposer` at the top of the feed, unchanged behaviour from the home feed.
2. Other profile: no composer.
3. Posts list: `PostCard` items, "Posts" section header with a filter control that matches the screenshot's `Filters` / `Manage posts` row. Filter control is own-profile-only.
4. Infinite scroll reusing the existing `?author_id=` cursor pagination.

**Acceptance**
- Posting from the profile appears at the top without a reload.
- Scrolling to the bottom loads the next page once, not twice.

---

### Phase 7 — Verification (2h)

1. `npm --prefix backend test` — all pass.
2. `npx tsc -p frontend/tsconfig.json --noEmit` — 0 errors.
3. `npx expo lint` — **65 errors, no more**.
4. `npx vitest run` — 41/41 plus any new tests.
5. `npm --prefix frontend run build` — clean.
6. Manual: own profile, other's profile, friend's profile, pending request, no-cover, no-bio, no-friends, no-photos; at 768 / 1024 / 1440 px; light and dark theme.
7. Mobile: confirm the layout is unchanged from before this work.

**Acceptance:** every number matches and the manual matrix is recorded in the task file.

---

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Restyling a 942-line file in one diff | Unreviewable, regressions hide | Phase 2 extracts first, with zero visual change |
| `friends_count` is a stat, the grid needs rows | Two sources that can disagree | Grid reads the endpoint; count reads `stats`; both derive from the same table |
| Cover images are large | 5 MB × every profile view | `AppImage` disk cache; `contentFit="cover"`; client-side resize before upload |
| New `covers` category means a new public prefix | One more thing to reason about | Public like `avatars`; R2 lifecycle not applicable (covers are permanent) |
| Composer extraction touches the home feed | Feed regression | Extracted in Phase 2 with a pixel comparison gate |
| Migration number collision with Quick Snap | Two files claim 049 | Next free number wins; update both task files in the same commit |

---

## 8. Out of scope

- Reels tab (no video feed)
- "More" tab
- Personal details (relationship status, gender) — no columns
- Contact info card — student email is not public data
- Highlights card — depends on Quick Snap shipping first
- Facebook's "Life update" and "Live video" composer actions
- Profile picture frame / cover cropping UI beyond the existing picker

---

## 9. Phase summary

| Phase | Scope | Est. | Gate |
|---|---|---|---|
| 0 | Baseline | 0.25h | Five numbers confirmed |
| 1 | Cover photo + friends/photos endpoints | 4h | Backend green, upload works |
| 2 | Extract components, no visual change | 5h | Pixel-identical, gates flat |
| 3 | Desktop header | 5h | Renders at 3 widths, empty states clean |
| 4 | Tabs + two-column body | 4h | Deep link keeps tab |
| 5 | Left column cards | 5h | No empty boxes |
| 6 | Right column | 3h | Post appears without reload |
| 7 | Verification | 2h | All gates at baseline |

**Total ≈ 28h.** Phase 2 is the checkpoint: if the extraction goes badly, stop before the restyle.
