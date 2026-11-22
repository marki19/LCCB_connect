# File Posting Fix & In-App File Viewer — Implementation Plan

## Problem Statement
1. **Cannot post files**:
   - In `frontend/app/create.tsx`, `attachmentsPayload` sends `sort_order`. However, `attachmentSchema` in `backend/validation/index.js` is `.strict()` and omitted `sort_order`, causing HTTP 400 "Validation failed" (`unrecognized_keys: ['sort_order']`).
   - File picker can return generic `mime` (`application/octet-stream`), which fails the strict `AttachmentMime` enum check.
2. **In-app File Viewer**:
   - Currently, clicking attached files in `AttachmentStrip` opens an external browser link via `Linking.openURL(url)`.
   - The user requested an in-app viewer for both web and mobile with a clean wrapper modal to preview files (PDFs, Office docs, images) directly inside the app, with actions to download or open externally.

## Architecture & Implementation Slices

### Phase 1: Backend Validation & Normalization
1. Update `backend/validation/index.js`:
   - Add `sort_order: z.number().int().min(0).optional()` to `attachmentSchema`.
   - Add `normalizeAttachmentMime` helper (or accept `application/octet-stream` and normalize based on file extension in filename).
2. Update `frontend/src/lib/upload.ts` & `frontend/app/create.tsx`:
   - Add `normalizeMimeType(fileName, rawMime)` to ensure picked documents always send their canonical MIME type.
3. Verify backend test suite passes:
   - `node --test backend/tests/validation.test.js`
   - `node --test backend/tests/postModel.attachments.test.js`

### Phase 2: In-App File Preview Modal Component
1. Create `frontend/src/components/files/FilePreviewModal.tsx`:
   - Responsive cross-platform modal (fullscreen on mobile, high-depth desktop modal up to 900px wide, 85vh tall).
   - Clean header with document icon, file name, file size badge, "Download / Open External" action, and close `(X)` button.
   - Embed body:
     - **PDFs**: native `iframe` on web, `WebView` or Google Docs viewer on mobile with zoom/scroll.
     - **Office Docs (.docx, .pptx, etc.)**: Google Docs viewer embed with fallback to document info card.
     - **Images**: `<AppImage>` contain preview.
     - **Fallbacks**: graceful loading state and clean card when offline/local.
2. Update `frontend/src/components/AttachmentStrip.tsx`:
   - Replace direct `Linking.openURL` with state opening `FilePreviewModal`.
   - Resolve URLs using `doc.url || resolveFileUrl(doc.storage_key)`.
3. Update `frontend/src/components/composer/AttachmentList.tsx`:
   - Allow clicking an attached document to preview it before publishing.

### Phase 3: Verification & Quality Gates
1. Run `npx tsc -p frontend/tsconfig.json --noEmit` -> 0 errors.
2. Run `npm --prefix frontend test` -> 71+ pass.
3. Run backend tests -> 100% pass.
