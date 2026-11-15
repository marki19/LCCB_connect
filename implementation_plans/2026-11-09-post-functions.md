# Post Functions — Implementation Plan

## Current State Analysis

### Backend (Express + Supabase)

| Resource | Model | Controller | Router | Key Features |
|----------|-------|------------|--------|--------------|
| **Posts** | `postModel.js` (19KB) | `postController.js` (12KB) | `postRouter.js` | 6 types (text, image, project, capstone, website, thesis), visibility (public/friends/custom/private), comments, likes, link preview, signed image URLs |
| **Theses** | `thesisModel.js` (12KB) | `thesisController.js` | `thesisRouter.js` | PDF-only, categories (Undergraduate/Graduate), visibility, signed PDF URLs, magic-byte validation |

### Frontend (React Native Expo)

| Screen | Purpose | Upload Path |
|--------|---------|-------------|
| `create.tsx` | 3-step wizard: Type → Content → Visibility | Images → Supabase `assets` bucket (direct) |
| `upload-thesis.tsx` | Title, abstract, category, PDF, visibility | PDF → Backend multipart → Supabase `theses` bucket |
| `post/[id].tsx` | Detail view with comments, likes, link preview | N/A (read-only) |

### Storage Architecture (Migration 011 → 015)

| Bucket | Public? | Purpose | Size Limit | Access |
|--------|---------|---------|------------|--------|
| `avatars` | Yes | Profile pictures | 2 MB | Public URL |
| `assets` | No | Post images | 5 MB | **Signed URL via backend** (`/posts/:id/file`) |
| `theses` | No | Manuscript PDFs | 50 MB | **Signed URL via backend** (`/theses/:id/file`) |

### Visibility Model (Migration 014)

Four levels: `public`, `friends`, `custom` (explicit audience list), `private` (author only). Enforced in `visible_posts(viewer)` / `visible_theses(viewer)` table-valued functions. Guests (`viewer = NULL`) see only `public` rows.

---

## Gaps & Deficiencies

### 1. Video Support — **Missing Entirely**
- No video MIME types in `BUCKET_MIME_TYPES` or storage policies
- No video upload UI in `create.tsx`
- No video playback component in `post/[id].tsx`
- No transcoding/thumbnail pipeline

### 2. PDF in Posts — **Partial**
- Posts support `type: "image"` but not `type: "pdf"` / `type: "document"`
- `assets` bucket allows only images (`image/png`, `image/jpeg`, `image/webp`)
- No PDF viewer component

### 3. Multiple Images per Post — **Single Image Only**
- `posts.image_url` is a single column (not array)
- UI only picks one cover image
- No gallery/carousel in detail view

### 4. Rich Text / Markdown — **Plain Text Only**
- `posts.content` stores raw text
- No formatting, mentions, hashtags (tags are separate array for project/capstone)

### 5. Link Preview — **Website Type Only**
- `generatePreview` endpoint exists but only used for `type: "website"`
- Could enhance link cards in text/image posts

### 6. Content Discovery — **No Search/Filter Endpoint**
- `GET /posts` returns paginated list but no query params for type, department, tags, date range
- Frontend search screen (`app/search.tsx`) exists but backend lacks faceted search

### 7. Moderation — **Hidden Status Only**
- `moderation_status` column exists (`hidden` / `pending` / `approved`)
- No moderation queue UI, no report flow for posts/theses

---

## Proposed Phases

### Phase A — Video Posts (Foundation)
**Scope:** Add video as a first-class post type.

| Task | Location | Details |
|------|----------|---------|
| A1 | Migration | Add `video` MIME types to `assets` bucket; increase size limit to 50 MB |
| A2 | `postModel.js` | Add `video_url`, `video_poster_url`, `duration` columns; update `createPost`/`updatePost` |
| A3 | `postController.js` | Handle video upload (multipart or direct-to-Supabase like images) |
| A4 | `create.tsx` | Add "Video" option card; video picker (expo-video-thumbnails for poster) |
| A5 | `post/[id].tsx` | Video player (expo-av) with poster, controls, fullscreen |
| A6 | Validation | `MAX_UPLOAD_BYTES.video = 50 MB`; MIME allowlist: `video/mp4`, `video/webm`, `video/quicktime` |

**Estimate:** 1.5 days

---

### Phase B — PDF/Documents in Posts
**Scope:** Allow PDF attachments on posts (not just theses).

| Task | Location | Details |
|------|----------|---------|
| B1 | Migration | Add `document_url`, `document_name`, `document_size` to `posts`; allow `application/pdf` in `assets` bucket |
| B2 | `postModel.js` | Extend create/update to handle document fields |
| B3 | `create.tsx` | Add "Document" option card; document picker (reuse `pickDocument`) |
| B4 | `post/[id].tsx` | PDF viewer (expo-document-picker can't render — need `react-native-pdf` or WebView fallback) |
| B4b | Alternative | Keep PDFs thesis-only; posts link to thesis records instead |

**Estimate:** 1 day (if reused thesis PDF flow)

---

### Phase C — Multiple Images (Gallery)
**Scope:** Carousel/gallery for image posts.

| Task | Location | Details |
|------|----------|---------|
| C1 | Migration | Add `post_images` table (post_id, image_url, sort_order, caption) |
| C2 | `postModel.js` | CRUD for `post_images`; eager-load in `getPost`/`getPosts` |
| C3 | `create.tsx` | Multi-select images (expo-image-picker `allowsMultipleSelection`); reorder UI |
| C4 | `post/[id].tsx` | Horizontal carousel (react-native-snap-carousel or flatlist + paging) |

**Estimate:** 1.5 days

---

### Phase D — Rich Text / Mentions / Hashtags
**Scope:** Upgrade `content` from plain text.

| Task | Location | Details |
|------|----------|---------|
| D1 | Migration | Add `content_html` or `content_md` column; keep `content` for search |
| D2 | Editor | Integrate `react-native-quill` or `slate` (heavy) OR lightweight markdown textarea + preview |
| D3 | `@mention` | Autocomplete against friends/directory; store as structured metadata |
| D4 | `#hashtag` | Extract on submit; link to tag search |

**Estimate:** 2–3 days (editor is heavy; recommend markdown-first)

---

### Phase E — Enhanced Discovery (Search & Filters)
**Scope:** Backend query params + frontend filter UI.

| Task | Location | Details |
|------|----------|---------|
| E1 | `postController.getPosts` | Accept `type`, `department_id`, `tags[]`, `visibility`, `author_id`, `date_from`, `date_to`, `sort` |
| E2 | Indexes | Composite indexes for common filter combos |
| E3 | `app/search.tsx` | Filter chips, type tabs, department dropdown, tag autocomplete |

**Estimate:** 1 day

---

### Phase F — Moderation & Reports
**Scope:** User reports, moderation queue, admin actions.

| Task | Location | Details |
|------|----------|---------|
| F1 | Migration | `post_reports` table (reporter_id, post_id, reason, status, created_at) |
| F2 | `postRouter.js` | `POST /posts/:id/report`, `GET /admin/posts/reports` |
| F3 | `post/[id].tsx` | "Report" menu item → modal with reason picker |
| F4 | Admin screen | Queue with approve/hide/delete actions; audit log |

**Estimate:** 1.5 days

---

## Prioritization & Dependencies

```
Phase A (Video) ──────────────┐
Phase B (PDF in Posts) ───────┤  Independent; can run in parallel
Phase C (Multi-Image) ────────┘
         │
         ▼
Phase D (Rich Text) ──────────► Requires editor choice; blocker for mentions
         │
         ▼
Phase E (Search) ─────────────► Depends on tag/mention metadata from D
         │
         ▼
Phase F (Moderation) ─────────► Can start after E (needs reportable items)
```

**Recommended Order:** A → B → C → E → D → F  
(Videos and PDFs are high-value, low-dependency. Search unlocks discovery. Rich text is heavy — defer until editor decision. Moderation last.)

---

## Non-Functional Requirements

| Requirement | Current | Target |
|-------------|---------|--------|
| Upload size (video) | N/A | 50 MB client, 100 MB bucket |
| Upload size (PDF) | 50 MB (thesis only) | 25 MB (posts) |
| Transcoding | None | **Defer** — accept raw MP4/WebM; add Cloudflare Stream/Mux later |
| Thumbnails | None | Client-side via `expo-video-thumbnails` |
| CDN | Supabase Storage | Supabase Storage (signed URLs) |
| Offline | None | Queue drafts locally; sync on reconnect |

---

## Open Questions

1. **Video transcoding:** Accept raw uploads now, add server-side transcoding later? (Recommended: yes — keeps Phase A simple)
2. **PDF viewer:** `react-native-pdf` adds native dependency (EAS build required). Acceptable?
3. **Rich text editor:** Markdown + preview (light) vs. Quill/Slate (heavy)? Recommend markdown-first.
4. **Multiple images:** Separate `post_images` table vs. JSONB array on `posts`? Table scales better for ordering/captions.
5. **Video storage bucket:** Reuse `assets` (private, signed URLs) or new `videos` bucket? Reuse `assets` with higher size limit.

---

## Acceptance Criteria per Phase

| Phase | Definition of Done |
|-------|-------------------|
| A | User can create "Video" post, pick MP4/WebM, see poster in feed, play inline with controls |
| B | User can create "Document" post, attach PDF, open in-app viewer (or system viewer fallback) |
| C | User can attach 3+ images to one post, swipe carousel in detail, reorder before publish |
| D | User can type markdown, see live preview, `@mention` friends, `#tag` topics |
| E | Search screen filters by type, department, tags, date; results < 300ms p95 |
| F | User can report post; admin sees queue; hide/delete actions audit-logged |

---

## Files to Modify (Summary)

| Phase | Backend | Frontend |
|-------|---------|----------|
| A | `migrations/XX_video_posts.sql`, `postModel.js`, `postController.js`, `postRouter.js`, `validation/index.js` | `create.tsx`, `post/[id].tsx`, `upload.ts`, `api.ts` |
| B | `migrations/XX_post_documents.sql`, `postModel.js`, `postController.js` | `create.tsx`, `post/[id].tsx`, `upload.ts` |
| C | `migrations/XX_post_images.sql`, `postModel.js`, `postController.js` | `create.tsx`, `post/[id].tsx` |
| D | `migrations/XX_rich_text.sql`, `postModel.js` | `create.tsx` (editor), `post/[id].tsx` (renderer) |
| E | `postController.js` (query params), `postModel.js` (filtered query) | `app/search.tsx` |
| F | `migrations/XX_reports.sql`, `postController.js`, `postRouter.js` | `post/[id].tsx`, new `app/admin/reports.tsx` |