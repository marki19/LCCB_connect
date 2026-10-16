import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { PresenceProvider } from "../src/contexts/PresenceContext";
import {
  observeNotificationTaps,
  observeTokenRefresh,
  registerForPush,
} from "../src/lib/push";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import "../global.css";

// Disable strict Reanimated warnings for layout animations
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

import { LogBox } from "react-native";
LogBox.ignoreLogs([
  "Response.blob() is using React Native's Blob",
]);

function RouteGuard() {
  const { session, profile, initialized, isGuest } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const userId = session?.user?.id ?? null;

  // Push registration (§10). Runs once the session exists; guests never register.
  useEffect(() => {
    if (!userId || isGuest) return;
    void registerForPush();
    const offTokenRefresh = observeTokenRefresh();
    return () => offTokenRefresh();
  }, [userId, isGuest]);

  // Deep-link a tapped push to its thread. Waits for auth so a cold-start tap
  // isn't dropped (the last response is consumed once, in `push.ts`).
  useEffect(() => {
    if (!initialized || !userId || isGuest) return;
    const offTap = observeNotificationTaps((conversationId) => {
      router.push(`/messages/${conversationId}`);
    });
    return () => offTap();
  }, [initialized, userId, isGuest, router]);

  useEffect(() => {
    if (!initialized) return;

    const inAuth = segments[0] === "(auth)";
    const inComplete = segments[0] === "complete-profile";
    const isAdminUser = session && profile && (profile.role === 'admin' || profile.role === 'superadmin');
    const isAuthenticated = !!session || isGuest;

    // A real (non-guest, non-campus-admin) account missing a department must
    // finish the one-time profile-completion gate before using the app.
    const needsProfile =
      !!session &&
      !isGuest &&
      !!profile &&
      profile.role !== "admin" &&
      profile.role !== "superadmin" &&
      !profile.department_id;

    if (!isAuthenticated && !inAuth) {
      // Not logged in - send to login
      router.replace("/(auth)/login");
    } else if (isAuthenticated && needsProfile && !inComplete) {
      router.replace("/complete-profile");
    } else if (isAuthenticated && inAuth) {
      // Already logged in or browsing as guest - route based on role
      if (isAdminUser) {
        router.replace("/(admin)/");
      } else {
        router.replace("/(tabs)/");
      }
    } else if (isAuthenticated && inComplete && !needsProfile) {
      // Finished the gate - send home.
      if (isAdminUser) {
        router.replace("/(admin)/");
      } else {
        router.replace("/(tabs)/");
      }
    }
  }, [session, profile, initialized, segments, isGuest]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="complete-profile" options={{ presentation: "modal" }} />
      <Stack.Screen name="create" options={{ presentation: "modal" }} />
      <Stack.Screen name="edit-profile" options={{ presentation: "modal" }} />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="messages/index" />
      <Stack.Screen name="messages/[id]" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="settings" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PresenceProvider>
          <RouteGuard />
        </PresenceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}