import { View, Platform, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import InboxPane from "../../src/components/messages/InboxPane";
import MessagesSplit from "../../src/components/messages/MessagesSplit";
import DesktopTopBar, { TOP_BAR_HEIGHT } from "../../src/components/topbar/DesktopTopBar";
import { useTheme } from "../../src/contexts/ThemeContext";

/**
 * Chats tab route.
 * Mobile renders the Messenger-style inbox with sticky bottom navigation.
 * Wide desktop web gets the dual-pane split view.
 */
export default function ChatsTabScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();

  const isSplit = Platform.OS === "web" && width >= 900;

  if (isSplit) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
        <DesktopTopBar />
        <View style={{ flex: 1, marginTop: TOP_BAR_HEIGHT }}>
          <MessagesSplit />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage, paddingBottom: 64 }}>
      <InboxPane
        onSelect={(id) => router.push(`/messages/${id}`)}
        showBack={false}
      />
    </View>
  );
}
