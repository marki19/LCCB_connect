# Mobile UI Layout & Navigation Fixes Plan

**Date**: 2026-11-28  
**Scope**: Mobile headers safe area, bottom tab bar soft nav clearance, Settings drawer flex layout, EmptyState CTA button contrast, Login Google/Guest button layout, and Expo Router hidden tab navigation fixes.

---

## 1. Problem Statements & Root Causes

1. **Header Safe Area Overlaps (Messages, Home, Projects, Saved)**:
   - On Android devices with status bars, `useSafeAreaInsets().top` can evaluate to `0` or insufficient padding when status bar translucency is enabled without window insets.
   - `InboxPane.tsx` and `capstones.tsx` use static padding without safe area insets, causing header text ("Messages", "Academic Capstones") to overlap the status bar clock, battery, and signal icons.
   - *Fix*: Standardize top padding using `Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0) + offset`.

2. **Bottom Tab Bar System Navigation Overlap**:
   - `MobileTabBar` in `app/(tabs)/_layout.tsx` applies `paddingBottom: Math.max(insets.bottom, 8)`.
   - On Android devices with 3-button system navigation (Back, Home, Recents), `insets.bottom` evaluates to `0`, causing the system buttons to render on top of the tab icons and labels.
   - *Fix*: Change bottom padding to `Math.max(insets.bottom, Platform.OS === 'android' ? 18 : 8)`.

3. **Settings & Privacy Drawer Row Stacking**:
   - In `SettingsSidebar.tsx`, `MenuItem` and the profile header place `flexDirection: "row"` directly on `<Pressable>` styled via dynamic functions and arrays containing `focusRing`.
   - On React Native Android Yoga layout, this causes the container to collapse to `flexDirection: "column"`, stacking the Icon, Label, and Chevron vertically on 3 separate lines.
   - *Fix*: Wrap contents of `MenuItem` and the profile card in an explicit inner `<View style={{ flexDirection: "row", alignItems: "center", width: "100%", gap: SPACE.x3 }}>` with `flexShrink: 1` on text.

4. **Empty State Invisible Button on Messages**:
   - `EmptyState.tsx` implements a hand-rolled `<Pressable>` with `focusRing` (which includes invalid Android CSS `boxShadow`) and `colors.textOnBrandSolid`.
   - On light theme, the background fails to render, leaving white text on a white card background.
   - *Fix*: Replace hand-rolled Pressable with design system `<Button variant="primary" size="sm" label={actionLabel} iconRight={ArrowRight} onPress={onAction} />`.

5. **Login Screen Google Auth & Guest Buttons Stacking**:
   - In `frontend/app/(auth)/login.tsx`, the "Continue with Google" and "Explore as guest" buttons use hand-rolled `<Pressable>` tags with dynamic inline function styles.
   - On Android / NativeWind v4, the inline style is stripped, causing the Google icon and text to stack vertically in a column with no container border or background.
   - *Fix*: Replace the hand-rolled Pressables in `login.tsx` with standard `<Button variant="secondary" size="lg" fullWidth icon={GoogleIcon} label="Continue with Google" ... />` and `<Button variant="ghost" size="md" fullWidth icon={Globe} label="Explore as guest" ... />`.

6. **Missing Screens & Route Redirections**:
   - `app/(tabs)/_layout.tsx` marks `profile` and `discussions` with `options={{ href: null }}`. In Expo Router, `href: null` compiles to `options.hidden: true`, which forces the tab navigator to redirect away to the first tab (`capstones`) whenever focused.
   - `SettingsSidebar.tsx` and push notification handlers navigate to `/friends`, but no root `app/friends.tsx` exists.
   - *Fix*: Remove `options={{ href: null }}` from `profile` and `discussions` in `_layout.tsx`, and add `app/friends.tsx` and `app/profile/index.tsx` redirects.

---

## 2. Proposed Changes

### A. Headers Safe Area
- **`frontend/src/components/HomeHeader.tsx`**: Add `StatusBar.currentHeight` fallback to `topInset`.
- **`frontend/src/components/messages/InboxPane.tsx`**: Add `useSafeAreaInsets` and `StatusBar.currentHeight` to header padding.
- **`frontend/app/(tabs)/capstones.tsx`**: Add `useSafeAreaInsets` and `StatusBar.currentHeight` to `styles.header`.
- **`frontend/app/saved.tsx`**: Add `useSafeAreaInsets` and `StatusBar.currentHeight` to `styles.feedHeaderRow`.
- **`frontend/src/components/SettingsSidebar.tsx`**: Ensure profile header padding respects `StatusBar.currentHeight`.

### B. Bottom Tab Bar System Clearance
- **`frontend/app/(tabs)/_layout.tsx`**: Update `mobileBar` padding bottom to `Math.max(insets.bottom, Platform.OS === 'android' ? 18 : 8)`.
- **`frontend/app/(tabs)/messages.tsx`**: Update bottom padding to clear the taller tab bar.

### C. Settings Sidebar Flex Layout
- **`frontend/src/components/SettingsSidebar.tsx`**:
  - Restructure `MenuItem` to use an inner `<View style={{ flexDirection: "row", alignItems: "center", width: "100%", gap: SPACE.x3 }}>`.
  - Restructure profile header `<Pressable>` to use an explicit inner row `<View>`.

### D. Empty State CTA Button
- **`frontend/src/components/ui/EmptyState.tsx`**:
  - Replace custom `<Pressable>` with `<Button variant="primary" size="sm" ... />`.

### E. Login Google & Guest Buttons
- **`frontend/app/(auth)/login.tsx`**:
  - Replace hand-rolled `<Pressable>` for Google Sign-In with `<Button variant="secondary" size="lg" fullWidth icon={GoogleIcon} label="Continue with Google" onPress={...} />`.
  - Replace hand-rolled `<Pressable>` for Guest with `<Button variant="ghost" size="md" fullWidth icon={Globe} label="Explore as guest" onPress={...} />`.

### F. Navigation & Routes
- **`frontend/app/(tabs)/_layout.tsx`**: Remove `options={{ href: null }}` from `profile` and `discussions`.
- **`frontend/app/friends.tsx`**: Create redirect route to `/(tabs)/friends`.
- **`frontend/app/profile/index.tsx`**: Create redirect route to `/(tabs)/profile`.

---

## 3. Verification & Deployment Plan
1. Run TypeScript check: `npx tsc --noEmit` in `frontend/`.
2. Run Expo Doctor: `npx expo-doctor` in `frontend/`.
3. Commit and build preview APK via EAS Cloud:
   `npx eas-cli build --platform android --profile preview --non-interactive`
4. Install APK onto connected device `vivo 1901` (`192.168.1.5:45941`) using ADB.
5. Take ADB screenshots of:
   - Login screen (verify Google and Guest buttons render as clean horizontal pill buttons).
   - Messages screen (verify status bar clearance, empty state button, bottom nav bar clearance).
   - Home screen (verify status bar clearance, bottom nav bar clearance).
   - Settings & Privacy drawer (verify horizontal row alignment of all menu items).
   - Navigation to profile and friends.
