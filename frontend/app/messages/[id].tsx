import { View, Platform, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import ThreadPane from "../../src/components/messages/ThreadPane";
import MessagesSplit from "../../src/components/messages/MessagesSplit";
import DesktopTopBar, { TOP_BAR_HEIGHT } from "../../src/components/topbar/DesktopTopBar";
import { safeBack } from "../../src/lib/navigation";
import { useTheme } from "../../src/contexts/ThemeContext";

/**
 * Thread route. Deep links (notifications, post/profile "Message" buttons) land
 * here. On wide desktop windows the thread opens beside the conversation list;
 * on phones it renders ThreadPane full-screen with a back button.
 */
export default function ThreadScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id ?? null;
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const isSplit = Platform.OS === "web" && width >= 900;

  if (isSplit) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
        <DesktopTopBar />
        <View style={{ flex: 1, marginTop: TOP_BAR_HEIGHT }}>
          <MessagesSplit key={conversationId ?? "none"} initialId={conversationId} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <ThreadPane
        conversationId={conversationId}
        onBack={() => safeBack("/messages")}
      />
    </SafeAreaView>
  );
}
