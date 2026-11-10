import { Platform, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import InboxPane from "../../src/components/messages/InboxPane";
import MessagesSplit from "../../src/components/messages/MessagesSplit";
import { safeBack } from "../../src/lib/navigation";
import { useTheme } from "../../src/contexts/ThemeContext";

/**
 * Inbox route. Wide desktop windows get the list + thread split view; phones
 * and tablets keep the single-column inbox that pushes `/messages/:id`.
 */
export default function MessagesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const isSplit = Platform.OS === "web" && width >= 900;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      {isSplit ? (
        <MessagesSplit />
      ) : (
        <InboxPane
          onSelect={(id) => router.push(`/messages/${id}`)}
          showBack
          onBack={() => safeBack("/(tabs)")}
        />
      )}
    </SafeAreaView>
  );
}
