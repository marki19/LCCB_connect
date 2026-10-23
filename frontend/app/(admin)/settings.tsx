import { View, Text, ScrollView } from "react-native";
import { useTheme } from "../../src/contexts/ThemeContext";
import PageHeader from "../../src/components/admin/PageHeader";

export default function AdminSettingsScreen() {
  const { colors } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{ padding: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader
        eyebrow="System / preferences"
        title="System Settings"
        description="Not available yet."
      />

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: 24,
          maxWidth: 640,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
          No settings API exists.
        </Text>
        <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>
          Institution-level settings need product-defined keys and effects before this screen can
          be built. Until then, this page stays read-only rather than showing controls that do not
          change anything.
        </Text>
        <Text style={{ marginTop: 12, fontSize: 12, color: colors.textTertiary }}>
          Tracked as API-REQ-001 in docs/API-REQUESTS.md.
        </Text>
      </View>
    </ScrollView>
  );
}
