# Quick Snap — Implementation Plan

**Date:** 2026-11-16
**Branch:** `mark1e3`
**Status:** awaiting approval

---

## 1. What this builds

A 24-hour photo/video feature called **Quick Snap**. A user posts a *snap* to a chosen audience; it is visible for 24 hours and then disappears. Viewers can react with a heart, comment, and reply to comments.

**Vocabulary — used everywhere, no exceptions:**

| Term | Meaning |
|---|---|
| Quick Snap | the feature |
| snap | one 24-hour post |
| snaps | the author's history of their own snaps |
| rail | the horizontal row of circles at the top of the feed |
| viewer | the full-screen playback modal |

Never "story", never "my day", never "stories".

---

## 2. Locked decisions

These were decided with the user and are not open for re-litigation during implementation.

1. **Separate `snaps` table.** Not `posts` with `type='story'`. Posts carry likes, comments, reposts, saves, and an infinite feed query; a snap has none of that and a hard TTL.
2. **Visibility reuses the existing enum.** `content_visibility` already contains `public | friends | department | custom | private`, and `visible_posts()` already implements the rules. `visible_snaps()` is a port, not an invention.
3. **Snap media is a public storage category** (`snaps/` prefix in the `lccb-connect` bucket). Same posture as `posts` today: visibility is enforced in the query, not on the bytes. R2 lifecycle deletes the bytes at day 1.
4. **`expo-video` is the only new dependency.** Camera capture comes from `expo-image-picker` (`launchCameraAsync`), already installed.
5. **24 hours is literal.** After expiry a snap is gone for everyone, including its author. The author's history keeps the row and shows it as "Expired" with no media.
6. **No new bottom tab.** The rail lives on the feed; history is reached from your own rail circle and from your profile.
7. **One level of replies.** A reply to a reply attaches to the same parent.
8. **API returns raw storage keys for snaps**, like posts. The client resolves with `resolveFileUrl()`. No change to `middleware/storageUrls.js`.

---

## 3. Current state of the codebase (verified 2026-11-16)

Reused, not rebuilt:

| Asset | Location | What it gives us |
|---|---|---|
| `content_visibility` enum + rules | `backend/migrations/036_department_post_visibility.sql:11-52` | The exact visibility predicate to port |
| `friendships` + `is_friend(a,b)` | `006_messaging_core.sql`, `014_content_visibility.sql` | Friends-only audience |
| `blocks` table | referenced in `visible_posts` | Block filtering comes free |
| `videos` storage category | `backend/services/filePolicy.js:70-74` | mp4/webm + magic bytes, 50 MB |
| Upload pipeline | `uploadRouter.js`, `middleware/upload.js`, `uploadService.js` | `POST /api/upload/:category` already generic |
| `VisibilityPicker.tsx` | `frontend/src/components/` | Audience UI, used by `create.tsx`, `post-settings.tsx`, `upload-thesis.tsx` |
| `AppImage` + `fileKeyFromUrl` | `frontend/src/components/AppImage.tsx`, `src/lib/files.ts` | Stable cache keys for rail thumbnails |
| `notifications` table | `backend/schema.sql` | `type` is unconstrained text — new types need no migration |
| `launchCameraAsync` | `expo-image-picker` | Camera capture, no new dependency |
| Migration runner | `npm run db:migrate` → `scripts/migrate.js` | Alphabetical, idempotent, tracked in `_migrations` |

Missing entirely: `snaps` table, snap routes, rail, viewer, composer, history, video player.

---

## 4. Target architecture

```
frontend/
  app/(tabs)/index.tsx            rail inserted into the feed header
  app/snap/create.tsx             composer (camera / gallery / caption / audience)
  app/snaps.tsx                   your history (active + expired)
  src/components/snaps/
    SnapRail.tsx
    SnapViewer.tsx
    SnapProgress.tsx
    SnapCommentSheet.tsx
  src/components/AppVideo.tsx     shared video primitive (also used by post video)
  src/hooks/useSnaps.ts
  src/lib/snaps.ts                API client + types

backend/
  migrations/049_quick_snap.sql
  models/snapModel.js
  controllers/snapController.js
  routes/snapRouter.js
  services/filePolicy.js          + snaps category
  middleware/actionLimits.js      + snapUploadLimiter, snapCommentLimiter
  tests/snaps.test.js
```

Data flow: client uploads bytes → `POST /api/upload/snaps` returns key → `POST /api/snaps` stores the key + audience → rail reads `GET /api/snaps/rail` → viewer reads `GET /api/snaps/:id` → media served by `GET /api/files/snaps/<hash>` (302 to R2).

---

## 5. Phases

### Phase 0 — Baseline lock (30 min)

Before any code, confirm the tree is green so a later failure is attributable.

1. `git status` clean on `mark1e3`.
2. `npm --prefix backend test` → record pass count (expect 675).
3. `npx tsc -p frontend/tsconfig.json --noEmit` → 0 errors.
4. `npx expo lint` in `frontend/` → record error count (expect 65).
5. `npx vitest run` in `frontend/` → record pass count (expect 41).

**Acceptance:** the five numbers are written into the task file. Every later phase compares against them.

---

### Phase 1 — Foundation: video primitive + storage category (3h)

**Goal:** a snap can be a video and the bytes can be stored, before any snap logic exists.

**Files**
- `frontend/package.json` — add `expo-video`
- `frontend/src/components/AppVideo.tsx` — new
- `backend/services/filePolicy.js` — add `snaps`
- `frontend/src/lib/upload.ts` — `snaps` MIME entry, size ceiling, capture helpers
- `backend/tests/filePolicy.test.js` — extend

**Tasks**

1. `npx expo install expo-video` inside `frontend/`. Verify `expo-video` appears in `package.json` and that the version matches the SDK 58 line.
2. Create `AppVideo.tsx`:
   - Props: `source` (storage key or absolute URL), `style`, `autoPlay`, `loop`, `muted`, `contentFit`, `onEnd`, `poster`.
   - Resolve the source through `resolveFileUrl()` so a raw key works.
   - Use `useVideoPlayer` + `VideoView`; pause by default in feeds, autoplay only in the viewer.
   - `nativeControls={false}` in the viewer (the viewer owns the progress bar), `nativeControls` on in feed cards.
   - Do **not** attempt `cacheKey` — `expo-video` has no equivalent. Web relies on the browser cache; native relies on the platform player cache.
3. Add to `filePolicy.js`:
   - `CATEGORIES` += `"snaps"`
   - `PUBLIC_CATEGORIES` += `"snaps"`
   - `CATEGORY_RULES.snaps = { maxBytes: 25MB, allowedExtensions: [".jpg",".jpeg",".png",".webp",".mp4",".webm"], allowedMimes: [image/jpeg, image/png, image/webp, video/mp4, video/webm] }`
   - `EXTENSION_MIME` already covers all five extensions — no change.
4. In `upload.ts`:
   - `BUCKET_MIME_TYPES.snaps` matching the backend.
   - `MAX_UPLOAD_BYTES.snap = 25 * 1024 * 1024`.
   - `captureSnap()` → `launchCameraAsync({ mediaTypes: ['images','videos'], videoMaxDuration: 30, quality: 0.8 })`.
   - `pickSnap()` → `launchImageLibraryAsync` with the same media types and duration cap.
   - Both return `{ uri, type, name, durationMs? }`.
5. Extend `filePolicy.test.js`: snaps accepts jpg/png/webp/mp4/webm; rejects a 26 MB buffer; rejects a `.gif`; rejects a `.mp4` whose bytes are not `ftyp`.

**Acceptance**
- `npx tsc --noEmit` still 0 errors.
- `filePolicy` tests pass, including the four new rejection cases.
- `AppVideo` renders in a scratch screen without a runtime error on web.

**Risks**
- `expo-video` needs a custom dev client rebuild if the project uses one. Expo Go is fine.
- `launchCameraAsync` on web falls back to a file input — acceptable.

---

### Phase 2 — Data layer: migration `049_quick_snap.sql` (2h)

**Goal:** the schema, the visibility function, and the indexes exist and apply cleanly.

**Tasks**

1. Write `backend/migrations/049_quick_snap.sql`. Follow the shape of `036`: `ALTER TYPE` outside a transaction, everything else inside `BEGIN; … COMMIT;`, `IF NOT EXISTS` / `CREATE OR REPLACE` throughout so a re-run is harmless.

```sql
-- 049_quick_snap.sql
-- Quick Snap: 24-hour photo/video snaps with hearts, comments, and replies.

BEGIN;

CREATE TABLE IF NOT EXISTS public.snaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_key TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  caption TEXT,
  visibility public.content_visibility NOT NULL DEFAULT 'public',
  author_department_id UUID REFERENCES public.departments(id),
  moderation_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('approved','flagged','hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE TABLE IF NOT EXISTS public.snap_views (
  snap_id UUID NOT NULL REFERENCES public.snaps(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (snap_id, viewer_id)
);

CREATE TABLE IF NOT EXISTS public.snap_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snap_id UUID NOT NULL REFERENCES public.snaps(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.snap_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('approved','flagged','hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.snap_reactions (
  snap_id UUID NOT NULL REFERENCES public.snaps(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (snap_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_snaps_author_expiry
  ON public.snaps (author_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_snaps_expiry
  ON public.snaps (expires_at);
CREATE INDEX IF NOT EXISTS idx_snaps_feed
  ON public.snaps (visibility, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_snap_comments_snap
  ON public.snap_comments (snap_id, created_at);
CREATE INDEX IF NOT EXISTS idx_snap_views_viewer
  ON public.snap_views (viewer_id, snap_id);

CREATE OR REPLACE FUNCTION public.visible_snaps(viewer text)
RETURNS SETOF public.snaps
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT s.*
  FROM public.snaps s
  WHERE s.moderation_status <> 'hidden'
    AND s.expires_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = s.author_id AND b.blocked_id = viewer)
         OR (b.blocker_id = viewer AND b.blocked_id = s.author_id)
    )
    AND (
      s.author_id = viewer
      OR s.visibility = 'public'
      OR (
        s.visibility = 'department'
        AND EXISTS (
          SELECT 1 FROM public.profiles viewer_pr
          WHERE viewer_pr.id = viewer
            AND viewer_pr.department_id IS NOT NULL
            AND viewer_pr.department_id = s.author_department_id
        )
      )
      OR (s.visibility = 'friends' AND public.is_friend(s.author_id, viewer))
      OR (s.visibility = 'private' AND s.author_id = viewer)
    );
$$;

REVOKE ALL ON FUNCTION public.visible_snaps(text) FROM PUBLIC;

COMMIT;
```

2. `custom` visibility: `visible_posts` needs `post_audience`. Snaps have no audience table, so `custom` is **not** offered in the composer. Document that in `snapController` — reject `visibility='custom'` with 400.
3. Apply the RLS/GRANT treatment used for `posts` in `001_rls_hardening.sql` to all four tables.
4. Run `npm --prefix backend run db:migrate` against the dev database.
5. Confirm `tests/migrations.test.js` and `tests/schema-init.test.js` still pass.

**Acceptance**
- Migration applies cleanly and is idempotent on a second run.
- `SELECT * FROM visible_snaps('<a user id>')` returns rows for a public snap and none for a hidden one.
- Existing migration tests green.

---

### Phase 3 — Backend API (8h)

**Goal:** every endpoint the client needs, with visibility and expiry enforced in SQL, not in JavaScript.

**Files:** `models/snapModel.js`, `controllers/snapController.js`, `routes/snapRouter.js`, `middleware/actionLimits.js`, `app.js`, `tests/snaps.test.js`

**Endpoints**

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/snaps` | body `{ media_key, media_type, caption?, visibility }`; derives `author_department_id` from the profile |
| `GET` | `/api/snaps/rail` | authors with ≥1 visible active snap; `unseen_count` per author; own snaps first |
| `GET` | `/api/snaps/:id` | one snap; 404 if not visible; marks viewed |
| `GET` | `/api/snaps/mine` | own snaps, active and expired, newest first |
| `DELETE` | `/api/snaps/:id` | author or admin only |
| `GET` | `/api/snaps/:id/comments` | flat list with `parent_id`; only if the snap is visible |
| `POST` | `/api/snaps/:id/comments` | body `{ content, parent_id? }`; rejects a reply-to-reply |
| `DELETE` | `/api/snaps/comments/:commentId` | comment author, snap author, or admin |
| `POST` | `/api/snaps/:id/heart` | toggles; returns `{ hearted, count }` |
| `POST` | `/api/snaps/:id/report` | reuses the report table and reason list |

**Tasks**

1. `snapModel.js` — every read goes through `visible_snaps($1)`; no hand-written visibility predicates in JS. Include `purgeExpired(authorId)` (deletes the caller's own snaps past `expires_at`) called opportunistically from the rail endpoint, fire-and-forget.
2. `snapController.js` — validate `media_key` with `parseKey()` from `filePolicy` and require `category === 'snaps'`; reject `media_type` that contradicts the key extension; reject `visibility='custom'`; cap caption at 500 chars.
3. `snapRouter.js` — mounted at `app.use("/api/snaps", …)` behind the same auth chain as `postRouter`.
4. `actionLimits.js` — `snapUploadLimiter` (20/day per user), `snapCommentLimiter` (60/hour), both env-tunable like the existing limiters so tests can raise them.
5. Notifications — direct inserts (not `createNotifications`, which targets admins): `snap_comment` → snap author, `snap_reply` → parent comment author, `snap_reaction` → snap author. Skip self-notification.
6. `tests/snaps.test.js`:
   - visibility matrix: public / friends / department / private × friend / non-friend / same-department / stranger
   - expiry: a snap with `expires_at` in the past is invisible to everyone including the author's rail, but still appears in `/mine`
   - block: a blocked viewer sees nothing
   - views: marking twice leaves one row
   - hearts: toggling twice returns to 0 and one row
   - comments: a stranger cannot comment on a friends-only snap; a reply-to-reply is rejected
   - cascade: deleting a snap removes its views, comments, reactions

**Acceptance**
- New suite passes; total backend count rises from the Phase 0 baseline with zero failures.
- No endpoint returns a snap the caller should not see, proven by the matrix test.

**Risks**
- `visible_snaps` returns `SETOF public.snaps`, so adding a column later needs no function change. Good.
- Opportunistic purge runs on a user request; if the instance is asleep it does not run. Expiry is still enforced by the `WHERE`, so this only affects housekeeping.

---

### Phase 4 — Rail (3h)

**Goal:** a student opens the feed and sees who has posted a snap.

**Files:** `src/hooks/useSnaps.ts`, `src/components/snaps/SnapRail.tsx`, `src/lib/snaps.ts`, `app/(tabs)/index.tsx`

**Tasks**

1. `src/lib/snaps.ts` — typed API client (`Snap`, `SnapAuthor`, `SnapComment`), mirroring the shape of existing `api.ts` helpers.
2. `useSnaps()` — fetches the rail, exposes `refresh`, `markSeen`, and an optimistic `heart`.
3. `SnapRail.tsx`:
   - horizontal `FlatList`, 76 px circles, 12 px gap.
   - Your own snap first: coral ring when unseen, grey when seen, a `+` badge when you have none.
   - Thumbnails via `AppImage` so `snaps/<hash>` cache keys apply — zero network on revisit.
   - Video snaps show a small play glyph over the first frame.
   - Tapping opens `SnapViewer` at that author's first unseen snap.
   - Long-press your own circle → `/snaps` (history).
   - Empty state: only your own `+` circle. No explanatory text.
4. Insert into `app/(tabs)/index.tsx` as part of the `FlatList` header, above the composer, so it scrolls with the feed.
5. Desktop: the same rail renders inside the existing desktop feed column. No separate component.

**Acceptance**
- Rail renders on mobile and desktop.
- Switching tabs and returning does not re-download thumbnails (network panel shows no image requests).
- Rail does not block the feed's first paint — it loads after posts render.

---

### Phase 5 — Viewer + engagement (8h)

**Goal:** full-screen playback with hearts, comments, and replies.

**Files:** `src/components/snaps/SnapViewer.tsx`, `SnapProgress.tsx`, `SnapCommentSheet.tsx`, `app/(tabs)/_layout.tsx` (modal route if needed)

**Tasks**

1. `SnapProgress.tsx` — segmented bars, one segment per snap in the current author's set. Filled = watched. Driven by a timer for images, by `onProgress` from `AppVideo` for video.
2. `SnapViewer.tsx`:
   - Modal, black background, `contentFit="contain"`.
   - Tap right third → next; tap left third → previous; long-press → pause; swipe down → dismiss.
   - Auto-advance after 5 s for images; video advances on `onEnd`.
   - Advancing past the last snap of an author moves to the next author.
   - Header: avatar, name, relative time. Footer: caption, heart button, comment button.
   - Author sees a delete control and a seen-count.
   - Non-author sees report.
   - Calls `POST /api/snaps/:id` on open to mark viewed (idempotent).
   - Prefetches the next author's first frame while the current plays.
3. `SnapCommentSheet.tsx` — bottom sheet: comment list with one level of indentation, reply composer, `@name` prefix on replies. Heart is a separate button in the viewer footer, not in the sheet.
4. Optimistic heart: toggle immediately, reconcile on response.
5. Keyboard handling: the sheet must not cover the composer on Android.

**Acceptance**
- Progress advances and pauses correctly for both media types.
- A video snap reaches the end and advances without a stall.
- Hearting twice leaves the count unchanged.
- Comments appear without a full reload.
- Viewer opens in under 300 ms when the thumbnail is already cached.

**Risks**
- Video URL is a 302 to a 300-second presigned R2 URL. Seeking after five minutes may 403. Snaps are ≤30 s, so this is theoretical; if it appears, raise the presign TTL for the `snaps` category only.
- iOS silent-switch behaviour: default `expo-video` audio follows the ringer switch. Decide explicitly and document.

---

### Phase 6 — Composer + history (4h)

**Goal:** post a snap in under ten seconds; see your own snaps afterwards.

**Files:** `app/snap/create.tsx`, `app/snaps.tsx`

**Tasks**

1. `app/snap/create.tsx`:
   - Two entry buttons: **Camera** (`captureSnap`) and **Gallery** (`pickSnap`). No third option.
   - Preview: `AppImage` or `AppVideo` with `autoPlay loop muted`.
   - Caption input, 500 chars, no helper text — the placeholder states the limit.
   - `VisibilityPicker` — `public`, `friends`, `department`, `private` only.
   - Publish: upload to `snaps` → `POST /api/snaps` → close and refresh the rail.
   - Reject >30 s video and >25 MB before upload, with a toast stating the limit.
2. `app/snaps.tsx`:
   - **Active** — full thumbnails, tap to replay, seen count, delete.
   - **Expired** — greyed tile, "Expired", no media, delete.
   - Empty state: one button that opens the composer.
3. Entry points: long-press your rail circle, and a row in the profile screen.

**Acceptance**
- A snap posted from the camera appears in your rail immediately.
- A 40-second video is refused client-side before any bytes leave the device.
- Expired snaps show no media and cannot be opened.

---

### Phase 7 — Post video attachments (4h)

**Goal:** the same player makes video work on regular posts, which is where uploads already happen.

**Files:** `backend/migrations/050_post_video.sql`, `backend/services/filePolicy.js`, `frontend/app/create.tsx`, `PostCard.tsx`, `PostImageGallery.tsx`, `post/[id].tsx`, `src/lib/api.ts`

**Tasks**

1. Migration `050_post_video.sql`: `ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS video_url TEXT;` and extend the `type` CHECK to include `'video'` (drop and recreate the constraint; the existing constraint is unnamed, so find it by definition).
2. `FILE_FIELD_BUCKETS` in `storageService.js` already maps `video_url` → `videos`. No change needed — confirm with a test.
3. `create.tsx`: a video option alongside images; upload to `videos` (50 MB cap); a post may have images or one video, never both.
4. `PostCard` and `PostImageGallery`: render `AppVideo` with native controls, no autoplay, first frame as the poster.
5. `post/[id].tsx`: full-width player, autoplay on open.
6. `api.ts` `adaptPost`: resolve `video_url` through `resolveFileUrl`.

**Acceptance**
- Uploading a 20 MB mp4 to a post succeeds and plays on web and Android.
- A post with both images and a video is rejected with a clear message.
- Feed scroll stays smooth with three video posts on screen (no autoplay, paused players).

**Risks**
- Memory: `MAX_CONCURRENT_UPLOADS = 4` × 50 MB = 200 MB of buffers on a 512 MB instance. Already true today for theses; video makes it likelier. If uploads start 502-ing, lower the post-video cap to 25 MB rather than raising instance size.

---

### Phase 8 — Moderation, limits, cleanup (2h)

**Tasks**

1. Report reasons for snaps: reuse the existing reason list from `reportRouter.js`; add `snap` as a target type.
2. Admin/moderation surfaces: a reported snap appears with its author and caption; hide sets `moderation_status='hidden'`, which `visible_snaps` already filters.
3. R2 lifecycle rule (dashboard, manual): delete objects under prefix `snaps/` after **1 day**. Document it in `implementation_plans/2026-11-16-quick-snap.md` as a one-time manual step, with a screenshot path.
4. Opportunistic purge confirmed working: after a user with expired snaps opens the rail, their expired rows are gone.
5. Rate limits verified by test: the 21st snap in a day returns 429.

**Acceptance**
- A hidden snap disappears from the rail for everyone, including its author.
- A reported snap is visible to moderators.
- Expired rows are removed after a rail load.

---

### Phase 9 — Verification and release (2h)

**Tasks**

1. Backend: `npm --prefix backend test` — all pass, count ≥ Phase 0 baseline + new tests.
2. Types: `npx tsc -p frontend/tsconfig.json --noEmit` — 0 errors.
3. Lint: `npx expo lint` — **65 errors, no more**. Any new error blocks the phase.
4. Frontend tests: `npx vitest run` — all pass, including new snap tests.
5. Build: `npm --prefix frontend run build` — `dist/index.html` produced.
6. Manual matrix, recorded in the task file:
   - mobile: post a photo snap, a video snap, a friends-only snap
   - mobile: switch tabs and return — rail thumbnails do not reload
   - mobile: heart, comment, reply from a second account
   - web: video plays in the viewer and in a post
   - expired: set a snap's `expires_at` to the past in SQL, confirm it vanishes
7. `git push origin mark1e3` after Render and Vercel are confirmed to deploy.

**Acceptance:** every number above matches. No claim of completion without the actual output pasted.

---

## 6. API contract

```ts
type Snap = {
  id: string;
  author_id: string;
  author: { id: string; name: string; avatarUrl: string | null; department_name?: string };
  media_key: string;          // raw key, client resolves
  media_type: "image" | "video";
  caption: string | null;
  visibility: "public" | "friends" | "department" | "private";
  created_at: string;
  expires_at: string;
  heart_count: number;
  hearted: boolean;
  comment_count: number;
  viewed: boolean;
};

type SnapRailEntry = {
  author: Snap["author"];
  snaps: Snap[];
  unseen_count: number;
  has_video: boolean;
};
```

---

## 7. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| 302 presign TTL (300 s) shorter than a long viewing session | Seek fails after 5 min | Snaps are ≤30 s; if it appears, raise the TTL for `snaps` only |
| 200 MB of upload buffers on a 512 MB instance | 502 during peak | Lower caps, not instance size. Snap 25 MB, post video 50 MB |
| `expo-video` needs a dev-client rebuild | Build breaks for one developer | Expo Go covers it; note the rebuild command in the phase |
| Web has no `cacheKey` | Web thumbnails re-fetch after the 240 s redirect window | Accepted; mobile is the target |
| Public `snaps` category means a leaked URL outlives the 24 h rule | Privacy | R2 lifecycle deletes the bytes at day 1 |
| `custom` visibility has no audience table for snaps | Silent no-op | Composer offers four options; API rejects `custom` |
| Opportunistic purge never runs on a sleeping instance | Dead rows accumulate | Expiry enforced in the query, so users never see them |

---

## 8. Out of scope

- Text-only snaps, stickers, drawing, filters
- Snap-to-DM replies (the alternative considered and rejected; see conversation)
- Snap analytics beyond a seen count
- Following / public profiles
- Video thumbnails generated server-side (no ffmpeg; first frame is the poster)
- Story-like highlights that outlive 24 h

---

## 9. Phase summary

| Phase | Scope | Est. | Gate |
|---|---|---|---|
| 0 | Baseline lock | 0.5h | Five numbers recorded |
| 1 | `expo-video`, `AppVideo`, `snaps` category | 3h | `tsc` 0, policy tests green |
| 2 | Migration 049 + `visible_snaps` | 2h | Migration applies twice cleanly |
| 3 | Snap API + tests | 8h | Visibility matrix green |
| 4 | Rail | 3h | No thumbnail reload on tab switch |
| 5 | Viewer, hearts, comments | 8h | Progress + video advance correct |
| 6 | Composer + history | 4h | Camera snap lands in the rail |
| 7 | Post video attachments | 4h | mp4 plays on web + Android |
| 8 | Moderation, limits, lifecycle | 2h | Hidden snap invisible everywhere |
| 9 | Verification + push | 2h | All five gates at baseline |

**Total ≈ 36.5h.** Slices 1–5 are a shippable Quick Snap; 6–9 complete it.
