import { useEffect } from "react";
import { View, Platform, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import ThreadPane from "../../src/components/messages/ThreadPane";
import MessagesSplit from "../../src/components/messages/MessagesSplit";
import { safeBack } from "../../src/lib/navigation";
import { useTheme } from "../../src/contexts/ThemeContext";

/**
 * Thread route. Deep links (notifications, post/profile "Message" buttons) land
 * here. On wide desktop windows the thread opens within DesktopLayout beside
 * the conversation list; on phones it renders ThreadPane full-screen with a back button.
 */
export default function ThreadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id ?? null;
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const isSplit = Platform.OS === "web" && width >= 900;

  useEffect(() => {
    if (isSplit && conversationId) {
      router.replace({ pathname: "/(tabs)/messages", params: { id: conversationId } } as any);
    }
  }, [isSplit, conversationId, router]);

  if (isSplit) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
        <MessagesSplit key={conversationId ?? "none"} initialId={conversationId} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <ThreadPane
        conversationId={conversationId}
        onBack={() => safeBack("/(tabs)/messages")}
      />
    </SafeAreaView>
  );
}
