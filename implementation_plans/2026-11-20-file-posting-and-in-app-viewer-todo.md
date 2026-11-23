# File Posting Fix & In-App File Viewer — Todo List

- [x] **Phase 1: Backend Validation & Client Normalization**
  - [x] Add `sort_order` and mime normalization to `backend/validation/index.js`.
  - [x] Add `normalizeMimeType` to `frontend/src/lib/upload.ts` and use in `frontend/app/create.tsx`.
  - [x] Verify backend tests pass (`validation.test.js`, `postModel.attachments.test.js`).

- [x] **Phase 2: In-App File Preview Modal**
  - [x] Create `frontend/src/components/files/FilePreviewModal.tsx` supporting PDFs, Office docs, and images with iframe/WebView and clean card fallbacks.
  - [x] Update `frontend/src/components/AttachmentStrip.tsx` to open `FilePreviewModal` on tap instead of `Linking.openURL`.
  - [x] Update `frontend/src/components/composer/AttachmentList.tsx` to support tapping to preview attached files.

- [x] **Phase 3: Quality Gates & Verification**
  - [x] `npx tsc -p frontend/tsconfig.json --noEmit` -> 0 errors.
  - [x] `npm --prefix frontend test` -> 71/71 passed across 15 test files.
  - [x] Backend test suite verification -> 26/26 validation tests & 5/5 attachment model tests passed.
