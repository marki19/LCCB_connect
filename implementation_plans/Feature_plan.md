# Feature Plan: Add Edit/Delete to Posts

## Overview
Implement edit and delete functionality for posts. Backend already provides `updatePost` and `deletePost` endpoints via `/posts/:id` (PUT and DELETE). Frontend needs UI and API calls.

## Steps

### 1. Backend Verification
- Confirm `postController.updatePost` and `deletePost` exist and work with raw SQL.
- Routes in `postRouter.js` already mount these methods.
- No backend changes needed.

### 2. Frontend: PostCard Component
- Add an edit/delete row or overflow menu under each post.
- Show edit/delete only if the current user is the post author (check `profile.id` vs `post.author.id`).
- On edit: navigate to a create/edit screen with pre-filled fields.
- On delete: show a confirmation dialog, then call DELETE `/posts/:id`, on success remove the card or navigate back.

### 3. Frontend: PostDetailScreen
- Add edit/delete buttons in the header or actions area.
- Same ownership check.
- Edit: navigate to create screen with post data pre-filled.
- Delete: confirmation, then DELETE, then navigate back to feed.

### 4. Create/Edit Screen Reuse
- Modify `CreatePostModal` (or create a new `EditPostModal`) to accept an optional `postId` and pre-fill fields when editing.
- Use the same form for both create and edit.
- On submit, if editing, call PUT `/posts/:id`; otherwise POST `/posts`.

### 5. API Service Helper (optional but good practice)
- Create a small helper in `frontend/src/lib/api.js` for `updatePost(id, data)` and `deletePost(id)` to keep consistency.

### 6. Testing
- Manual test: log in, create a post, verify edit/delete appear only for own posts.
- Test edit updates fields, delete removes post.
- Verify other users' posts do not show edit/delete.

## Files to Touch
- `frontend/src/components/PostCard.tsx`
- `frontend/app/post/\[id\].tsx` (PostDetailScreen)
- `frontend/src/components/CreatePostModal.tsx` (or create EditPostModal)
- `frontend/src/lib/api.js` (new)
- Possibly `frontend/src/contexts/AuthContext.js` (already used for profile)

## Estimated Time
~2 hours for implementation and quick test.

## Done Criteria
- Edit and delete buttons visible only on own posts.
- Edit opens form with current values, saves changes.
- Delete removes post and shows success.
- No errors in console; API calls succeed.