# Task List: Multi-Image Posts & Gallery Grid

## Phase 1: Database & Backend Engine
- [x] Task 1.1: Create `backend/migrations/033_post_multi_images.sql` and run/verify migration
- [x] Task 1.2: Add `image_urls` to `backend/validation/index.js`
- [x] Task 1.3: Update `backend/models/postModel.js` to select, insert, and update `image_urls`
- [x] Task 1.4: Update `backend/services/storageService.js` and `backend/controllers/postController.js` to sign multi-image arrays
- [x] Task 1.5: Write unit tests in `backend/tests/multi-image-posts.test.js` and verify passing (398/398 backend tests pass)

## Phase 2: Frontend Multi-Image Upload
- [x] Task 2.1: Add `pickMultipleImages` in `frontend/src/lib/upload.ts`
- [x] Task 2.2: Add `image_urls` to `frontend/src/types.ts`
- [x] Task 2.3: Update `frontend/app/create.tsx` to select, preview, and upload up to 4 photos

## Phase 3: Gallery Grid & Lightbox
- [x] Task 3.1: Create `frontend/src/components/PostImageGallery.tsx` with Facebook-style 1/2/3/4 layouts and SVG lightbox
- [x] Task 3.2: Wire `PostImageGallery` into `frontend/src/components/PostCard.tsx` and `frontend/app/post/[id].tsx`
- [x] Checkpoint: Verify zero TypeScript errors (`tsc --noEmit`) and verify all backend tests pass cleanly
