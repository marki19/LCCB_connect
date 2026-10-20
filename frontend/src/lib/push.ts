import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerDeviceToken, unregisterDeviceToken } from "./messages";

/**
 * OS push (Messaging_plan.md §10, Phase 5).
 *
 * The third notification layer: the DB row + Realtime bell cover in-app, and
 * this covers "app backgrounded". It is **best-effort by design** — every entry
 * point swallows its errors so a missing EAS project id, an Expo Go build, or a
 * denied permission can never break the app.
 *
 * Requires an EAS **development build** with FCM/APNs credentials; in Expo Go on
 * Android, `getExpoPushTokenAsync` throws (SDK 53+) and registration is skipped.
 */

const TOKEN_KEY = "lccb.push.expoToken";

/**
 * The conversation currently on screen. Used to suppress the foreground banner
 * when the user is already reading the thread the push is about (§10 "when the
 * recipient isn't in the thread").
 */
let activeConversationId: string | null = null;

export function setActiveConversation(conversationId: string | null): void {
  activeConversationId = conversationId;
}

const dataOf = (
  response: Notifications.NotificationResponse | null
): Record<string, unknown> | undefined =>
  response?.notification?.request?.content?.data as Record<string, unknown> | undefined;

const conversationIdOf = (data: Record<string, unknown> | undefined): string | null =>
  typeof data?.conversationId === "string" ? data.conversationId : null;

const isInThread = (conversationId: string | null): boolean =>
  Boolean(conversationId && conversationId === activeConversationId);

// Foreground presentation. Suppress the banner/sound while the user is already
// looking at that conversation; otherwise show it.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const conversationId = conversationIdOf(
        notification.request.content.data as Record<string, unknown> | undefined
      );
      const inThread = isInThread(conversationId);
      return {
        shouldShowBanner: !inThread,
        shouldShowList: !inThread,
        shouldPlaySound: !inThread,
        shouldSetBadge: !inThread,
      };
    },
  });
}

/** Permission is "granted" if allowed outright or provisionally (iOS quiet mode). */
const hasPermission = (settings: Notifications.NotificationPermissionsStatus): boolean =>
  settings.granted ||
  settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

/**
 * Requests permission, obtains the Expo push token, and registers it with the
 * backend. Returns the token, or `null` when push is unavailable (web, no
 * permission, no EAS project id, Expo Go on Android, or offline).
 */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    // Android 13+: the channel must exist before the permission prompt/token.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Messages",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1D4ED8",
      });
    }

    let settings = await Notifications.getPermissionsAsync();
    if (!hasPermission(settings)) {
      settings = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    }
    if (!hasPermission(settings)) return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      console.warn("[push] no EAS project id — skipping push registration");
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await registerDeviceToken(token, Platform.OS as "ios" | "android");
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (err) {
    // Expected in Expo Go on Android and whenever Expo can't reach its servers.
    console.warn("[push] registration skipped:", (err as Error)?.message);
    return null;
  }
}

/**
 * Removes this device's token for the current user. Call on sign-out so a shared
 * device stops receiving the previous account's pushes.
 */
export async function unregisterForPush(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await unregisterDeviceToken(token).catch(() => undefined);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Best-effort: a stale token is pruned server-side on DeviceNotRegistered.
  }
}

/**
 * Re-registers when the OS rolls the push token (rare, but the old one becomes
 * invalid). Returns an unsubscribe function.
 */
export function observeTokenRefresh(): () => void {
  if (Platform.OS === "web") return () => {};
  const subscription = Notifications.addPushTokenListener(() => {
    void registerForPush();
  });
  return () => subscription.remove();
}

/**
 * Calls `onTap(conversationId)` for a notification the user tapped, including
 * the one that cold-started the app. Returns an unsubscribe function.
 *
 * The cold-start response is consumed **once** across subscriptions, so a
 * re-subscribe (e.g. after a token refresh) can't re-trigger navigation.
 */
let lastResponseHandled = false;

export function observeNotificationTaps(
  onTap: (conversationId: string) => void
): () => void {
  if (Platform.OS === "web") return () => {};

  const redirect = (response: Notifications.NotificationResponse | null) => {
    const conversationId = conversationIdOf(dataOf(response));
    if (conversationId) onTap(conversationId);
  };

  // The tap that launched the app (if any) — handled at most once.
  if (!lastResponseHandled) {
    lastResponseHandled = true;
    redirect(Notifications.getLastNotificationResponse());
  }

  const subscription = Notifications.addNotificationResponseReceivedListener(redirect);
  return () => subscription.remove();
}
