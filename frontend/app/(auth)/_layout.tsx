import { Stack } from "expo-router";

// Auth screens rendered as a plain stack — no tab bar.
// Each screen owns its own background, but only while it is focused (see
// AuthScaffold), so navigating forward/back never stacks opaque layers.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
