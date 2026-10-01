import { Stack } from "expo-router";

// Auth screens rendered as a plain stack — no tab bar
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}