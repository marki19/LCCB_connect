import { View, Text, TouchableOpacity } from "react-native";
import { AlignJustify, Search } from "lucide-react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  onMenuPress: () => void;
};

export default function HomeHeader({ onMenuPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        paddingTop: insets.top + 10,
        paddingBottom: 13,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#DBEAFE",
        shadowColor: "#1A56DB",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 5,
      }}
    >
      {/* Logo / Wordmark */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: "#1A56DB",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 14 }}>L</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#1A56DB", letterSpacing: -0.5 }}>
            LCCB Connect
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, marginLeft: 38 }}>
          Academic Portfolio Network
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => router.push("/(tabs)/search")}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Search projects"
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 6,
        }}
      >
        <Search size={21} color="#1A56DB" strokeWidth={2} />
      </TouchableOpacity>

      {/* Burger menu button */}
      <TouchableOpacity
        onPress={onMenuPress}
        activeOpacity={0.7}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "#EFF6FF",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "#DBEAFE",
        }}
      >
        <AlignJustify size={20} color="#1A56DB" strokeWidth={2} />
      </TouchableOpacity>
    </View>
  );
}
