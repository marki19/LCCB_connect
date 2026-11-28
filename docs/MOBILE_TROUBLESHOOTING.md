# Mobile Build & Authentication Post-Mortem

**Date:** 2026-11-28  
**Scope:** Android/iOS Standalone Mobile App (`com.lccb.connect`), EAS Build Pipeline, Google Sign-In OAuth, App Branding  

---

## 1. Issue Summary

| Issue | Symptoms | Root Cause | Status |
| :--- | :--- | :--- | :--- |
| **Google Sign-In Failure** | `DEVELOPER_ERROR` (code 10) on mobile login | 1. Remote EAS Keystore SHA-1 was unregistered in Google Cloud.<br>2. `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` was `undefined` in EAS Cloud.<br>3. `offlineAccess: true` triggered unnecessary server auth codes. | Resolved |
| **Default Expo Launcher Icon** | Home screen showed default Expo chevron icon | Project is prebuild/bare; EAS used existing `android/app/src/main/res/mipmap-*` assets. Prior build was canceled before testing. | Resolved |
| **Default Splash Screen** | Launch splash showed default Expo chevron | Native `drawable-*/splashscreen_logo.png` drawables held template Expo assets. | Resolved |
| **App Size >100 MB** | Downloaded preview APK was 104 MB | Universal APK bundled 4 native architectures (`armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`), consuming 89.4 MB in `.so` libs alone. | Resolved |

---

## 2. Technical Details & Root Cause Analysis

### 2.1 Google Sign-In `DEVELOPER_ERROR` (Code 10)
- **Location:** `frontend/app/(auth)/login.tsx` & Google Cloud Console
- **Cause 1 (Google Cloud Credentials):** Google Play Services validates the calling app's package name and SHA-1 certificate against registered Android OAuth clients in the Google Cloud project. EAS remote keystore was signing the APK with SHA-1 `D4:1B:AC:1B:28:36:83:E7:AF:A1:5A:7A:A3:27:08:5E:24:67:EC:7F`. The project only had `Web client 1` registered, causing Google Play Services to reject the app.
- **Cause 2 (Missing Env in EAS):** `frontend/.env` is gitignored. Because `frontend/eas.json` had no `env` block configured for the `preview` profile, `process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` evaluated to `undefined` during cloud Metro bundling.
- **Cause 3 (`offlineAccess`):** `GoogleSignin.configure({ offlineAccess: true })` requested a server authorization code instead of purely requesting the OpenID `idToken` consumed by the backend `/auth/google` endpoint.
- **Fix:**
  - Added Android OAuth Client ID in Google Cloud with package `com.lccb.connect` and SHA-1 `D4:1B:AC:1B:28:36:83:E7:AF:A1:5A:7A:A3:27:08:5E:24:67:EC:7F`.
  - Added fallback `webClientId` directly in `frontend/app/(auth)/login.tsx`.
  - Removed `offlineAccess: true`.
  - Added public environment variables to `preview` and `production` profiles in `frontend/eas.json`.

### 2.2 Launcher Icon & Splash Screen
- **Location:** `frontend/android/app/src/main/res/`
- **Cause:** Because `frontend/android` was present locally, EAS CLI ran a native Gradle build rather than generating native assets from `frontend/app.json`. The native `res/mipmap-*` and `res/drawable-*` directories still held Expo's template assets. Furthermore, build `d34993b0` (which included the initial asset commit) was canceled, leading to testing an older APK build (`d6281821`).
- **Fix:**
  - Regenerated all 25 native mipmap `.webp` icons across all densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`) embedding the circular LCCB seal on `#FFFFFF`.
  - Replaced all 5 `splashscreen_logo.png` drawables with the high-resolution LCCB seal.
  - Created `drawable/splashscreen.xml` layer-list to keep the logo centered on `#FFFFFF` without stretching.
  - Updated `values/styles.xml` to point `Theme.App.SplashScreen` to `@drawable/splashscreen`.
  - Unignored and committed `frontend/android` native resources to git.

### 2.3 APK Size Reduction (104 MB to 37.4 MB)
- **Location:** `frontend/eas.json` & `frontend/app.json`
- **Cause:** The default EAS preview profile created a Universal APK packaging 4 native CPU architectures:
  - `x86_64` (emulators): 24.96 MB
  - `x86` (emulators): 24.79 MB
  - `arm64-v8a` (modern 64-bit phones): 23.40 MB
  - `armeabi-v7a` (legacy 32-bit phones): 16.23 MB
  - *Native C++ binaries alone accounted for 89.38 MB (86% of the 104 MB APK).*
- **Fix:**
  - Added `-PreactNativeArchitectures=arm64-v8a` to the preview Gradle command in `frontend/eas.json`.
  - Excluded unused ABIs in `frontend/app.json` via `expo-build-properties` packaging options.
  - APK size dropped to **37.4 MB** (64% reduction). Modern Android devices (Android 9+) run `arm64-v8a` natively without dependencies.

---

## 3. Verification & Build Records

- **Successful Android Build:** [055d4bf1-7670-4586-b61e-5f5e0aac2c2e](https://expo.dev/accounts/geyyb/projects/LCCB_connect/builds/055d4bf1-7670-4586-b61e-5f5e0aac2c2e)
- **Successful iOS Build:** [90bebc3d-dc3d-423d-a155-038813fa4b3d](https://expo.dev/accounts/geyyb/projects/LCCB_connect/builds/90bebc3d-dc3d-423d-a155-038813fa4b3d)
- **Key Commits:**
  - `81f5a6b`: Initial login form UI/UX redesign & seal replacement.
  - `6d7520e`: arm64-v8a build target configuration.
  - `b214f08`: Native Android mipmap and splashscreen drawable replacements.
  - `a63ee1d`: Splashscreen layer-list centering & Google Sign-In fallback.
  - `adea617`: EAS build environment profile configuration.
