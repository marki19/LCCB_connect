import { View, Text, TouchableOpacity, Platform, useWindowDimensions } from "react-native";
import { AlignJustify, Search, MessageSquare } from "lucide-react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  onMenuPress: () => void;
};

export default function HomeHeader({ onMenuPress }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 768;

  // On desktop web, the top navigation bar is already rendered by _layout.tsx
  if (isDesktopWeb) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: "#DBEAFE",
        shadowColor: "#1A56DB",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 4,
      }}
    >
      {/* Left: Hamburger button (predictable: button on left -> sidebar opens from left) */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TouchableOpacity
          onPress={onMenuPress}
          activeOpacity={0.7}
          accessibilityLabel="Open navigation menu"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: "#EFF6FF",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "#DBEAFE",
          }}
        >
          <AlignJustify size={20} color="#1A56DB" strokeWidth={2.2} />
        </TouchableOpacity>

        {/* Wordmark Logo */}
        <View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A", letterSpacing: -0.4 }}>
            LCCB <Text style={{ color: "#1A56DB" }}>Connect</Text>
          </Text>
          <Text style={{ fontSize: 10, color: "#94A3B8", fontWeight: "600" }}>
            Academic Network
          </Text>
        </View>
      </View>

      {/* Right: Search & Messages actions */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/search")}
          activeOpacity={0.7}
          accessibilityLabel="Search"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "#F1F5F9",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Search size={18} color="#64748B" strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/messages")}
          activeOpacity={0.7}
          accessibilityLabel="Messages"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "#EFF6FF",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MessageSquare size={18} color="#1A56DB" strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
