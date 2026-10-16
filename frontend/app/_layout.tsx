import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
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

  useEffect(() => {
    if (!initialized) return;

    const inAuth = segments[0] === "(auth)";
    const isAdminUser = session && profile && (profile.role === 'admin' || profile.role === 'superadmin');
    const isAuthenticated = !!session || isGuest;

    if (!isAuthenticated && !inAuth) {
      // Not logged in - send to login
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuth) {
      // Already logged in or browsing as guest - route based on role
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
      <Stack.Screen name="create" options={{ presentation: "modal" }} />
      <Stack.Screen name="edit-profile" options={{ presentation: "modal" }} />
      <Stack.Screen name="post/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RouteGuard />
      </AuthProvider>
    </SafeAreaProvider>
  );
}