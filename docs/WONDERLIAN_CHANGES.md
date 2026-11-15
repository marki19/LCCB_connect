# Changes from `wonderLian` Branch

Summary of features, fixes, and architectural improvements merged from `wonderLian` (`origin/wonderLian`).

---

## 1. Storage & Upload Architecture (`0c5ade1`, `5c97450`, `4a2f36f`, `090c427`, `4ea02e8`)
- **Key-based Storage**: Backend stores relative storage keys (paths) in PostgreSQL instead of full public URLs.
- **Dynamic URL Expansion**: Added middleware in `backend/services/storageService.js` to expand keys to public URLs on responses without mutating nested metadata.
- **Upload Size Limits**:
  - Avatar: 2 MB limit
  - Post Images: 5 MB limit
  - Thesis PDFs: 50 MB limit
- **Storage Policies**: Migration `012_storage_size_limits.sql` pins thesis uploads to authenticated user directory paths (`<user.id>/`).

---

## 2. Post Likes (`432c75d`)
- **`is_liked` Flag**: Added scoped subquery in `backend/models/postModel.js` and `backend/controllers/postController.js` returning whether the calling user has liked each post.
- **UI Integration**: Feed (`frontend/app/(tabs)/index.tsx`), post detail (`frontend/app/post/[id].tsx`), and admin screens display active like state.
- **Spec Documentation**: Added `LCCB-Connect.md` documenting user flows and UI requirements.

---

## 3. Department Moderation Surface (`003d8a6`)
- **Moderation Routes**: Created dedicated desktop surface `(moderation)` in `frontend/app/(moderation)/` for `departmentAdmin`.
- **`ModerationQueue` Component**: Added queue interface (`frontend/src/components/moderation/ModerationQueue.tsx`) for review, hide/restore, and report handling.

---

## 4. Documentation & Cleanup (`003d8a6`)
- **Core Docs Added**:
  - `docs/API.md`: API specifications
  - `docs/BACKEND_CONTRACT.md`: Data contracts and expectations
  - `docs/UI_BUILD_RULES.md`: Styling and UI guidelines
  - `docs/API-REQUESTS.md`: Endpoints reference
- **Dead Code Cleaned**: Removed prototype mock backups (`comments.json`, `posts.json`, `users.json`) and deprecated `PaymentModal.tsx`.
- **OpenCode Skill**: Added `.opencode/skills/desloppify/SKILL.md`.

---

## 5. Security & Dependencies (`b3d1230`)
- **Vulnerability Patches**:
  - `body-parser` 2.3.0 → 2.4.0 (GHSA-27r3-jxmh-p828, High)
  - `qs` 6.16.0 → 6.17.1 (GHSA-6pq8-jhm2-2vcw, Moderate)

