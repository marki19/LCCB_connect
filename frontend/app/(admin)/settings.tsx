import { View, Text, ScrollView } from "react-native";
import { useTheme } from "../../src/contexts/ThemeContext";

export default function AdminSettingsScreen() {
  const { colors } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 26, fontWeight: "900", letterSpacing: -0.5, color: colors.textPrimary }}>
          System Settings
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
          Configure global application parameters.
        </Text>
      </View>

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: 24,
          minHeight: 400,
        }}
      >
        <Text style={{ fontSize: 13, fontStyle: "italic", color: colors.textTertiary }}>
          Settings form will be implemented here.
        </Text>
      </View>
    </ScrollView>
  );
}

