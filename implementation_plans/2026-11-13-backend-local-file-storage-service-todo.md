# Task List: Backend File Storage Service

- [x] Task 1: Create storage directory structure (`backend/uploads/` with subfolders) & update `.gitignore`
- [x] Task 2: Implement `localStorage.js` helper (SHA-256 filename hashing, safe path resolver, magic-byte inspection)
- [x] Task 3: Build `localUpload.js` middleware with multer for category-specific size & format limits
- [x] Task 4: Create `uploadRouter.js` (`POST /api/upload/:category`) for handling authenticated uploads
- [x] Task 5: Create `fileRouter.js` (`GET /api/files/:category/:filename`) with traversal protection, caching headers, and range requests
- [x] Task 6: Update `backend/services/storageService.js` to support local file URL expansion alongside legacy keys
- [x] Task 7: Update frontend upload helper (`frontend/src/lib/upload.ts`) to upload through `POST /api/upload`
- [x] Task 8: Unit & integration test suite (`backend/tests/local-storage.test.js`)
- [x] Task 9: Verification (typecheck + backend tests) & local commit

