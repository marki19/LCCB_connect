# Implementation Plan: Chat Photo & Media Uploads

Allow users to upload, send, and view photo attachments directly in chat conversations across both the desktop `FloatingChatWindow` and the mobile/desktop full-screen thread `frontend/app/messages/[id].tsx`.

## Architecture & Data Flow

1. **Storage Bucket & Key Policy:**
   - Bucket: `assets` (private storage bucket created in migration 015 with authenticated read & write policies).
   - Storage path pattern: `chat/{conversationId}/{timestamp}-{random}.jpg`.
   - File validation: Max 5 MB, mime types: `image/png`, `image/jpeg`, `image/webp`.

2. **Message Body Contract:**
   - Media message: JSON payload string:
     `{"type":"image","url":"chat/...","text":"optional caption"}`
   - Fallback compatibility: `[image:chat/...] caption`.
   - Normal text message: plain string.
   - Body length constraint: `1..4000` chars (satisfies backend `sendMessageSchema`).

3. **URL Resolution & Caching:**
   - Private `assets` objects are resolved to temporary signed URLs (TTL 24 hours) via `supabase.storage.from('assets').createSignedUrl(path, 86400)`.
   - In-memory signed URL cache prevents duplicate network signing roundtrips during scroll/render.

4. **Inbox & Push Preview:**
   - In `frontend/app/messages/index.tsx`, format image messages as `"Photo"` or `"Photo: " + caption`.
   - In `backend/services/pushService.js`, format push notification text as `"Sent a photo"` or `caption`.

5. **Icon Policy:**
   - STRICT: No emojis for icons. Use Lucide SVG icons only (`ImageIcon`, `X`, `Send`, `ZoomIn`, `Download`).

## Phased Execution

- **Phase 1: Shared Media Helper & Message Parser (`frontend/src/lib/chatMedia.ts`)**
  - Parse message body to detect media vs text.
  - Sane default upload & signed URL resolution with cache.
  - Image picker wrapper without forcing square crop.

- **Phase 2: Floating Mini-Chat Window (`frontend/src/components/chat/FloatingChatWindow.tsx`)**
  - Add image attachment SVG button.
  - Preview selected image with cancel SVG button before sending.
  - Render image bubbles with loading state.
  - Lightbox modal for full-screen view on tap.

- **Phase 3: Full-Screen Thread Screen (`frontend/app/messages/[id].tsx`)**
  - Add image attachment SVG button to composer.
  - Preview selected image with cancel SVG button.
  - Render image bubbles for incoming, outgoing, and pending messages.
  - Full-screen lightbox viewer modal on image tap.

- **Phase 4: Inbox & Push Clean Previews**
  - In `frontend/app/messages/index.tsx`, clean preview for image messages.
  - In `backend/services/pushService.js`, clean preview for image messages in push notifications.

- **Phase 5: Verification & Quality Gate**
  - Type-check frontend.
  - Run backend test suite.
  - Verify zero emoji icons.

