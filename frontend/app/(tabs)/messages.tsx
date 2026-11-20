import { View, Platform, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import InboxPane from "../../src/components/messages/InboxPane";
import MessagesSplit from "../../src/components/messages/MessagesSplit";
import { useTheme } from "../../src/contexts/ThemeContext";

/**
 * Chats tab route.
 * Mobile renders the Messenger-style inbox with sticky bottom navigation.
 * Wide desktop web gets the dual-pane split view with sidebars maintained.
 */
export default function ChatsTabScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id ?? null;
  const { width } = useWindowDimensions();
  const { colors } = useTheme();

  const isSplit = Platform.OS === "web" && width >= 900;

  if (isSplit) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
        <MessagesSplit key={conversationId ?? "default"} initialId={conversationId} />
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
