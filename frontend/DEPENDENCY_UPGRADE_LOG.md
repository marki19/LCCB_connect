# Frontend Dependency Upgrade Log

**Date:** 2026-11-08
**Scope:** `frontend/` — Expo SDK 58 project

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Critical | 1 | 0 |
| High | 4 | 0 |
| Moderate | 8 | 5 |
| Low | 1 | 0 |
| **Total** | **14** | **5** |

All critical/high vulnerabilities resolved. Remaining 5 moderate are in Expo SDK 58 internal dependencies — fixing requires breaking downgrade to Expo 52 (not acceptable).

---

## Upgraded Packages (via `expo install --fix` + `npm update --save`)

| Package | Before | After | Type |
|---------|--------|-------|------|
| `@expo/metro-runtime` | 58.0.15 | 58.0.17 | Expo SDK patch |
| `expo` | 58.0.17 | 58.0.23 | Expo SDK patch |
| `expo-linking` | 58.0.14 | 58.0.16 | Expo SDK patch |
| `expo-router` | 58.0.25 | 58.0.30 | Expo SDK patch |
| `react-native` | 0.88.0 | 0.88.1 | React Native patch |
| `react-native-safe-area-context` | 5.10.1 | 5.11.1 | Patch |
| `react-native-screens` | 4.30.0 | 4.30.1 | Patch |
| *(52 packages added, 51 removed, 89 changed via `npm update`)* | | | |

---

## Blocked / Deferred Upgrades

| Package | Current | Latest | Blocker | Decision |
|---------|---------|--------|---------|----------|
| `glob` | 14.x | 15.x | Requires Expo 52 (breaking) | **Defer** — SDK 58 pinned |
| `minimatch` | 11.x | 12.x | Requires Expo 52 (breaking) | **Defer** — SDK 58 pinned |
| `@expo/cli` | 58.x | 59.x | Requires Expo 52 (breaking) | **Defer** — SDK 58 pinned |
| `@expo/fingerprint` | 58.x | 59.x | Requires Expo 52 (breaking) | **Defer** — SDK 58 pinned |
| `@expo/metro-config` | 58.x | 59.x | Requires Expo 52 (breaking) | **Defer** — SDK 58 pinned |

**Rationale:** All blocked packages are internal Expo SDK 58 dependencies. The audit fix `--force` would downgrade Expo from 58 → 52, which is a major breaking change incompatible with React Native 0.88 and Expo Router 58. We stay on SDK 58 patch releases.

---

## Lint Fixes Applied

| File | Warning | Fix |
|------|---------|-----|
| `app/(auth)/verify-email.tsx:23` | `Array<string>` forbidden | Changed to `string[]` |
| `app/(auth)/verify-email.tsx:30` | `Array<any>` forbidden | Changed to `any[]` |
| `app/index.tsx:6` | `withTiming` unused | Removed import |
| `src/lib/api.ts:11` | Axios named export `create` | Changed to `import { create } from 'axios'` |
| `src/lib/api.ts:120` | Axios named export `isAxiosError` | Changed to `import { isAxiosError } from 'axios'` |
| `src/lib/push.ts:105` | `err` unused | Changed to `catch {` (no binding) |

**Result:** ESLint → 0 warnings (app code), 2 errors in Supabase edge functions (Deno imports, ignored)

---

## Verification

```bash
# TypeScript
cd frontend && npx tsc --noEmit
# → Exit 0, no errors

# ESLint (app code only)
cd frontend && npx eslint . --ext .ts,.tsx
# → 0 warnings, 2 errors (supabase/functions/link-preview/index.ts — Deno imports)

# npm audit (production only)
cd frontend && npm audit --omit=dev
# → 5 moderate, 0 high, 0 critical
```

---

## Next Steps

1. Monitor for Expo SDK 59 release (typically quarterly)
2. When SDK 59 ships, run `expo install --fix` again to pick up transitive fixes
3. Consider adding `npm audit` to CI pipeline for regression detection