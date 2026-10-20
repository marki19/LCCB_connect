import { router } from "expo-router";

/**
 * Safely navigates back if there is a history stack to return to.
 * Otherwise, falls back to a safe route (defaults to home tabs).
 */
export function safeBack(fallback: string = "/(tabs)") {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    // If canGoBack() fails for any reason, fall through to replace.
  }
  router.replace(fallback as any);
}
