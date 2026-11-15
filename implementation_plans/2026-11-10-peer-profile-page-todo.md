# Task List: Peer Profile Page (/profile/[id])

## Phase 1: Backend Endpoint & Data Access
- [x] Task 1.1: Add `getPublicProfile` method in `backend/models/userModel.js` with sanitized fields, block check, friendship check, and counts
- [x] Task 1.2: Add `getPublicProfile` controller in `backend/controllers/userController.js` and mount `GET /:id/profile` in `backend/routes/userRouter.js`
- [x] Task 1.3: Write automated unit tests in `backend/tests/peer-profile.test.js`
- [x] Checkpoint: Run backend test suite and verify clean pass (388/388 passed)

## Phase 2: Frontend Client & Routing
- [x] Task 2.1: Add `getUserProfile` and `sendFriendRequest` helper in `frontend/src/lib/api.ts`
- [x] Task 2.2: Add `<Stack.Screen name="profile/[id]" />` in `frontend/app/_layout.tsx`
- [x] Task 2.3: Build `frontend/app/profile/[id].tsx` with Facebook-style banner, presence dot, verified badge, contextual actions, and tabs (Posts, Theses, About)
- [x] Checkpoint: Verify zero TypeScript errors via `npx tsc --noEmit` and verify 100% SVG icons
