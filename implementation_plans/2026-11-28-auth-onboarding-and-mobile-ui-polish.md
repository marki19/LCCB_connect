# Implementation Plan - Auth, Onboarding & Mobile UI Polish

**Date**: 2026-11-28  
**Scope**: Google sign-in native cache revocation, login button styling & contrast, onboarding loading/role screens exit routes, notifications back button, duplicate SettingsSidebar sliver elimination, bottom tab bar label alignment, and post composer avatar spacing.

---

## 1. Problem Statements & Root Causes

1. **Google Account Picker Never Reappears**:
   - `logout()` in `src/lib/auth.ts` clears Supabase and SecureStore sessions, but does not invoke native `GoogleSignin.signOut()`. Google Play Services caches the signed-in Google account indefinitely, automatically picking it on subsequent logins.
   - *Fix*: Call `GoogleSignin.signOut()` during `logout()` on native platforms.

2. **Login Screen Google & Guest Buttons Look Like Text**:
   - `Button.tsx` container styles (`backgroundColor`, `borderWidth`, `borderColor`) were applied directly to `<Pressable>`, which NativeWind v4 strips on Android.
   - In dark theme, `colors.surface` on `colors.panel` with faint borders provides insufficient contrast.
   - *Fix*: Ensure `Button.tsx` renders its container on an inner `<View>` with crisp borders and solid fill (`colors.surfaceElevated` with visible border).

3. **"Verify your identity" Loading Screen is Clunky**:
   - `app/onboarding.tsx` displays a heavy card with `h1` and text while loading verification status.
   - *Fix*: Replace with a minimal, centered spinner and single line: `Checking your verification status…` on the page background.

4. **"What are you at LCCB?" Screen Has No Exit**:
   - In `app/onboarding.tsx`, the `needsRole` branch has no back button or exit route, trapping users if verification is optional.
   - *Fix*: Add an upper-left back chevron button that routes to `/(tabs)/` via `handleSkip()`.

5. **Notifications Screen Missing Back Button**:
   - `app/(tabs)/notifications.tsx` has no back button in the header.
   - *Fix*: Add an upper-left back button (`router.back()` or fallback to `/(tabs)/`).

6. **Settings Sidebar Cut-Off Sliver on Screen Edges**:
   - `app/(tabs)/index.tsx:552` mounts a second instance of `<SettingsSidebar />`, while `app/_layout.tsx:202` already mounts one globally. The home screen copy sits at `translateX: -width` inside a padded layout, leaking a ~16px sliver of text onto the screen.
   - *Fix*: Remove the duplicate instance from `index.tsx` and use `openSettingsSidebar()` from `useSettingsSidebar()`.
   - *Design*: Simplify the heavy blue hero band into a clean single-row header (avatar, name, department, close button).

7. **Bottom Tab Bar Text/Icon Misalignment**:
   - `MobileTabBar` in `app/(tabs)/_layout.tsx` uses a 40x30 icon bubble and text with `letterSpacing: -0.2` and absolute active indicator `top: -6`, making icons and text misaligned.
   - *Fix*: Center icon and label in a single vertical column (`alignItems: "center"`, `justifyContent: "center"`, `gap: 4`), remove negative letter-spacing, and clean up active indicator.

8. **Post Composer Avatar Too Close to Text Box**:
   - `src/components/PostComposer.tsx` uses `marginLeft: SPACE.x3` (12px).
   - *Fix*: Change to row `gap: SPACE.x4` (16px) so it cannot collapse.

---

## 2. Proposed File Changes

### A. Google Auth Revocation
- **`frontend/src/lib/auth.ts`**:
  ```ts
  if (Platform.OS !== "web") {
    try {
      const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
      await GoogleSignin.signOut();
    } catch {
      // Safe fallback if module not initialized or already signed out
    }
  }
  ```

### B. Button Component Native Rendering
- **`frontend/src/components/ui/Button.tsx`**:
  Wrap interactive container in inner `<View>` with explicit `backgroundColor`, `borderRadius`, `borderWidth`, and `borderColor` so NativeWind does not strip styles.

### C. Onboarding Screens Polish
- **`frontend/app/onboarding.tsx`**:
  - Replace `loading` state with clean centered `<ActivityIndicator>` and `Checking your verification status…` text.
  - In `needsRole` ("What are you at LCCB?"), add upper-left back/cancel button calling `handleSkip()`.

### D. Notifications Back Button
- **`frontend/app/(tabs)/notifications.tsx`**:
  Add upper-left back button row with safe area padding.

### E. Sidebar Deduplication & Header Cleanup
- **`frontend/app/(tabs)/index.tsx`**:
  Delete duplicate `<SettingsSidebar />` at line 552 and hook `HomeHeader` to `openSettingsSidebar()`.
- **`frontend/src/components/SettingsSidebar.tsx`**:
  Streamline profile header to a clean single row on dark/light background.

### F. Tab Bar Alignment & Post Composer Spacing
- **`frontend/app/(tabs)/_layout.tsx`**:
  Center tab icon and label in a single column layout; remove negative letter spacing.
- **`frontend/src/components/PostComposer.tsx`**:
  Set `gap: SPACE.x4` (16px) between avatar and text pill.

---

## 3. Verification Plan
1. Type check: `cd frontend; npx tsc --noEmit`.
2. Linter & Expo Doctor: `cd frontend; npx expo-doctor`.
3. Inspect diff: `git diff`.
4. *Do NOT build the app* until explicitly instructed by the user.
