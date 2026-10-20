import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { Platform, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { PresenceProvider } from "../src/contexts/PresenceContext";
import { ThemeProvider, useTheme } from "../src/contexts/ThemeContext";
import { isAdminRole, isSuspendedProfile } from "../src/lib/roles";
import {
  isAdminAppPreview,
  setAdminAppPreview,
} from "../src/lib/panelMode";
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
  "The action 'GO_BACK' was not handled by any navigator",
]);

function RouteGuard() {
  const { session, profile, initialized, isGuest } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

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
    const inAdmin = segments[0] === "(admin)";
    const inTabs = segments[0] === "(tabs)";
    const inSuspended = segments[0] === "suspended";
    const adminUser = isAdminRole(profile?.role);
    const suspended = !!profile && isSuspendedProfile(profile);
    const isAuthenticated = !!session || isGuest;

    // A fresh sign-in always starts panel-first for desktop admins.
    if (inAuth) setAdminAppPreview(false);

    // A real (non-guest, non-campus-admin) account missing a department must
    // finish the one-time profile-completion gate before using the app.
    const needsProfile =
      !!session &&
      !isGuest &&
      !!profile &&
      !adminUser &&
      !profile.department_id;

    if (!isAuthenticated && !inAuth) {
      // Not logged in - send to login
      router.replace("/(auth)/login");
    } else if (isAuthenticated && suspended && !inSuspended) {
      router.replace("/suspended");
    } else if (isAuthenticated && !suspended && inSuspended) {
      router.replace(adminUser && isDesktop ? "/(admin)/" : "/(tabs)/");
    } else if (isAuthenticated && needsProfile && !inComplete) {
      router.replace("/complete-profile");
    } else if (isAuthenticated && inAuth) {
      // Panel-first on desktop for campus admins; everyone else (and admins on
      // mobile) goes to the normal app.
      if (adminUser && isDesktop) {
        router.replace("/(admin)/");
      } else {
        router.replace("/(tabs)/");
      }
    } else if (
      isAuthenticated &&
      adminUser &&
      isDesktop &&
      inTabs &&
      !isAdminAppPreview()
    ) {
      // The profile can arrive one render after the session, so the auth-screen
      // branch above may already have sent the admin to the feed. Catch that
      // case unless they explicitly chose "Back to App".
      router.replace("/(admin)/");
    } else if (isAuthenticated && inComplete && !needsProfile) {
      // Finished the gate - send home.
      if (adminUser && isDesktop) {
        router.replace("/(admin)/");
      } else {
        router.replace("/(tabs)/");
      }
    } else if (isAuthenticated && inAdmin && (!adminUser || !isDesktop)) {
      // The panel is a desktop console. Never strand a mobile or non-admin
      // session on a screen it cannot use.
      router.replace("/(tabs)/");
    }
  }, [session, profile, initialized, segments, isGuest, isDesktop, router]);

  const { isDark, colors } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surfacePage },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="suspended" />
        <Stack.Screen name="complete-profile" options={{ presentation: "modal" }} />
        <Stack.Screen name="create" options={{ presentation: "modal" }} />
        <Stack.Screen name="edit-profile" options={{ presentation: "modal" }} />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="messages/index" />
        <Stack.Screen name="messages/[id]" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="settings" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <PresenceProvider>
            <RouteGuard />
          </PresenceProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}