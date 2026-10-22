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
        description="Configure global application parameters."
      />

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

