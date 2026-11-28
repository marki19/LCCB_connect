# Mobile Build & Authentication Post-Mortem

**Date:** 2026-11-28  
**Scope:** Android/iOS Standalone Mobile App (`com.lccb.connect`), EAS Build Pipeline, Google Sign-In OAuth, App Branding  

---

## 1. Issue Summary

| Issue | Symptoms | Root Cause | Status |
| :--- | :--- | :--- | :--- |
| **API 404 in Release Builds (P0)** | All API calls (`/auth/login`, `/users/:id`) fail with 404 | `EXPO_PUBLIC_API_URL` lacked the `/api` prefix in both `.env` and `eas.json`. | Resolved |
| **Google Sign-In Failure** | `DEVELOPER_ERROR` (code 10) on mobile login | 1. Remote EAS Keystore SHA-1 was unregistered in Google Cloud.<br>2. `offlineAccess: true` triggered unnecessary server auth codes. | Resolved |
| **Default Expo Launcher Icon** | Home screen showed default Expo chevron icon | Project had committed `frontend/android` breaking Continuous Native Generation (CNG). Prior build was canceled before testing. | Resolved |
| **Default Splash Screen** | Launch splash showed default Expo chevron | Legacy top-level `splash` key was deprecated in SDK 58; replaced with `expo-splash-screen` plugin. | Resolved |
| **App Size >100 MB** | Downloaded preview APK was 104 MB | Universal APK bundled 4 native architectures (`armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`), consuming 89.4 MB in `.so` libs alone. | Resolved |

---

## 2. Technical Details & Root Cause Analysis

### 2.1 Missing `/api` Suffix (P0 Bug)
- **Location:** `frontend/.env`, `frontend/eas.json`, and `frontend/src/lib/api.ts`
- **Cause:** `API_URL` in `api.ts` defines `const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api").replace(/\/+$/, "")`. The fallback contained `/api`, but `EXPO_PUBLIC_API_URL` was set to `https://lccb-connect.onrender.com`. In release builds, Axios sent requests to `https://lccb-connect.onrender.com/auth/login` instead of `https://lccb-connect.onrender.com/api/auth/login`, causing immediate 404s.
- **Fix:** Appended `/api` to `EXPO_PUBLIC_API_URL` across `frontend/.env` and both `preview` and `production` profiles in `frontend/eas.json`.

### 2.2 Google Sign-In `DEVELOPER_ERROR` (Code 10)
- **Location:** `frontend/app/(auth)/login.tsx` & Google Cloud Console
- **Cause 1 (Google Cloud Credentials):** Google Play Services validates the calling app's package name and SHA-1 certificate against registered Android OAuth clients in the Google Cloud project. EAS remote keystore was signing the APK with SHA-1 `D4:1B:AC:1B:28:36:83:E7:AF:A1:5A:7A:A3:27:08:5E:24:67:EC:7F`. The project only had `Web client 1` registered, causing Google Play Services to reject the app.
- **Cause 2 (`offlineAccess`):** `GoogleSignin.configure({ offlineAccess: true })` requested a server authorization code instead of purely requesting the OpenID `idToken` consumed by the backend `/auth/google` endpoint.
- **Fix:**
  - Registered Android OAuth Client ID in Google Cloud with package `com.lccb.connect` and SHA-1 `D4:1B:AC:1B:28:36:83:E7:AF:A1:5A:7A:A3:27:08:5E:24:67:EC:7F`.
  - Removed `offlineAccess: true` from `GoogleSignin.configure()`.
  - Configured explicit check for `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to fail loudly if unconfigured.

### 2.3 Continuous Native Generation (CNG) & Assets
- **Location:** `frontend/android/`, `frontend/app.json`, `.easignore`, `.gitignore`
- **Cause:** `frontend/android/` was committed to git, which violated `frontend/AGENTS.md` and caused EAS to bypass `app.json` configurations (icons, splash, build plugins).
- **Fix:**
  - Removed `frontend/android` from git index and disk.
  - Added `android/` and `ios/` to `frontend/.gitignore` and `frontend/.easignore`.
  - Configured `app.json` with the circular LCCB seal (`./assets/android-icon-foreground.png` and `./assets/icon.png`).
  - Configured `expo-splash-screen` plugin options with `./assets/splash-icon.png` and `#FFFFFF` background.
  - Aligned Expo SDK 58 package versions (`expo ~58.1.0`, `expo-image`, `expo-notifications`, `expo-router`).

### 2.4 APK Size Reduction (104 MB to 37.4 MB)
- **Location:** `frontend/eas.json`
- **Cause:** Default preview builds create a Universal APK bundling 4 native CPU architectures (89.4 MB in native `.so` files).
- **Fix:** Scoped `-PreactNativeArchitectures=arm64-v8a` to the preview `gradleCommand` in `eas.json` without applying global exclusions to production. APK size dropped from 104 MB to 37.4 MB.

---

## 3. Verification & Build Records

- **Key Commits:**
  - `81f5a6b`: Initial login form UI/UX redesign & seal replacement.
  - `6d7520e`: arm64-v8a build target configuration.
  - `a63ee1d`: Splashscreen layer-list centering & Google Sign-In fallback.
  - `39bc606`: Appended `/api` to API URL and added anon key to EAS profiles.
  - `eda9afb`: Restored CNG, cleaned `app.json` plugins, and aligned SDK 58 dependencies.
- **Verification Commands:**
  - `npx expo-doctor`: 20/20 checks passed.
  - `npx tsc --noEmit`: 0 errors.
