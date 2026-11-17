# Task List: Native Auth Service

- [x] Task 1: Create migration `045_native_auth.sql` (add `password_hash` and `email_confirmed_at` to `public.profiles`)
- [x] Task 2: Create `backend/services/nativeAuth.js` (JWT signing, verification, bcrypt helpers, token refresh)
- [x] Task 3: Update `backend/models/userModel.js` with native auth query helpers
- [x] Task 4: Update `backend/middleware/auth.js` to prioritize native JWT verification
- [x] Task 5: Update `backend/controllers/authController.js` and `authRouter.js` for native login, signup, reset, and refresh
- [x] Task 6: Unit & Integration tests in `backend/tests/native-auth.test.js`
- [x] Task 7: Full verification and local git commit
