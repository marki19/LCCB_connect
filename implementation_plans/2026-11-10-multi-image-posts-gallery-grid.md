# Multi-Image Posts & Gallery Grid Implementation Plan

## 1. Problem & Architecture Overview

Currently, posts in LCCB Connect only support a single `image_url` string.
Students and faculty frequently need to post multiple photos:
- Project showcases with multiple screenshots / hardware photos
- Campus events with multiple angles
- Discussion topics with multiple reference diagrams

### Architecture
1. **Database**:
   - `posts.image_urls TEXT[] DEFAULT '{}'::TEXT[]`.
   - Maintain `posts.image_url` as `image_urls[1]` for complete backwards compatibility.
2. **Backend**:
   - Validation allows `image_urls` (array of 1–4 storage keys).
   - `storageService.js` asynchronously signs all items in `image_urls`.
   - `getPostFile` returns `{ url, urls }`.
3. **Frontend Composer (`create.tsx`)**:
   - `pickMultipleImages` (up to 4 photos).
   - Composer displays a preview grid with SVG remove badges and an "+ Add Photo" button.
   - Uploads in parallel and stores keys.
4. **Frontend Gallery Grid (`PostImageGallery.tsx`)**:
   - Adaptive Facebook-style layout:
     - 1 image: Hero banner (240–300px height).
     - 2 images: 2 equal columns (50% each).
     - 3 images: 1 top hero + 2 bottom split columns.
     - 4 images: 2×2 balanced quad grid.
   - Tap to open high-resolution fullscreen lightbox with Lucide SVG controls (no emojis).

---

## 2. Phased Implementation Tasks

### Phase 1: Database & Backend Engine
- Create `backend/migrations/033_post_multi_images.sql`.
- Update `backend/validation/index.js` for `image_urls` array schema.
- Update `backend/models/postModel.js` queries and insert logic.
- Update `backend/services/storageService.js` to sign arrays of keys.
- Update `backend/controllers/postController.js` `getPostFile`.
- Add test suite `backend/tests/multi-image-posts.test.js`.

### Phase 2: Frontend Multi-Image Upload
- Add `pickMultipleImages` in `frontend/src/lib/upload.ts`.
- Update `frontend/src/types.ts` with `image_urls?: string[]`.
- Update `frontend/app/create.tsx` to handle up to 4 images.

### Phase 3: Gallery Grid & Lightbox
- Create `frontend/src/components/PostImageGallery.tsx` (1, 2, 3, 4 image grid + fullscreen lightbox).
- Wire `PostImageGallery` into `frontend/src/components/PostCard.tsx` and `frontend/app/post/[id].tsx`.
- Verify with `tsc --noEmit` and backend test suite.

