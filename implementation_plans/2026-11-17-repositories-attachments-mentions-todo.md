# Task List: Repositories, Attachments, and Mentions

Plan: `implementation_plans/2026-11-17-repositories-attachments-mentions.md`

## Part 1 — Repositories Core (Tasks 1–12)

- [x] Task 1: Schema — `kind`, `repository_type`, `post_attachments` table (migration `054_repository_posts.sql`)
- [x] Task 2: File policy — support `.pptx`, `.ppt`, `.doc` with OLE / OOXML magic bytes (`backend/services/filePolicy.js`)
- [x] Task 3: Frontend upload — document picker & Office MIME types (`frontend/src/lib/upload.ts`)
- [x] Task 4: Backend validation — `attachmentSchema`, `createPostSchema`, `updatePostSchema` (`backend/validation/index.js`)
- [x] Task 5: Post read projection — query & attach `post_attachments` (`backend/models/postModel.js`)
- [x] Task 6: Post create/update — transactionally persist attachments (`backend/models/postModel.js`)
- [x] Task 7: Storage service — resolve attachment signed/public URLs (`backend/services/storageService.js`)
- [x] Task 8: Post controller & routes — filter by `kind`, `repository_type`, `repository_category` (`backend/controllers/postController.js`)
- [x] Task 9: Frontend types & API client — `PostAttachment`, `kind`, `repository_type` (`frontend/src/types.ts`, `frontend/src/lib/api.ts`)
- [x] Task 10: Two-door composer — Discussion vs Repository tabs, typed fields, document attachment list (`frontend/app/create.tsx`)
- [x] Task 11: Post display — render document chips, repository badges, and attachment gallery (`frontend/src/components/PostCard.tsx`, `frontend/app/post/[id].tsx`)
- [x] Task 12: Feed filters & tabs — filter feeds by repository types (`frontend/src/lib/feedFilters.ts`, `frontend/app/(tabs)/index.tsx`)

## Part 2 — Thesis Merge (Tasks 13–16)

- [x] Task 13: Schema migration — migrate `theses` table into `posts` with PDF attachment (`backend/migrations/055_theses_into_posts.sql`)
- [ ] Task 14: Backend deprecation — remove `thesisModel.js` and `/api/theses` routes
- [ ] Task 15: Admin & moderation — update thesis queues to query repository posts
- [ ] Task 16: Frontend migration — redirect `/upload-thesis` and query posts in capstones/profile/search

## Part 3 — Mentions (Tasks 17–22)

- [ ] Task 17: Schema & policy — `post_mentions` table and `can_mention` function (`backend/migrations/056_post_mentions.sql`)
- [ ] Task 18: Mention service — parse `@handle` tokens, enforce friends ∪ department rule (`backend/services/mentions.js`)
- [ ] Task 19: Mention autocomplete API — `/api/users/mentionable` endpoint
- [ ] Task 20: Notification fan-out — deliver notifications for valid post and comment mentions
- [ ] Task 21: Frontend mention components — `MentionInput` and `RichText`
- [ ] Task 22: Composer & comment integration — replace inputs with `MentionInput`

## Contract Migration (Task 23)

- [ ] Task 23: Drop legacy columns — remove `posts.type`, `posts.image_url`, `posts.image_urls` (`backend/migrations/057_drop_legacy_post_columns.sql`)
