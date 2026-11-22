import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Eye, ShieldAlert } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function GuestBanner() {
  const { profile } = useAuth();
  const { colors } = useTheme();

  if (profile?.role !== "guest") return null;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.surfaceSunken,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.left}>
        <Eye size={16} color={colors.brand} />
        <Text style={[styles.text, { color: colors.ink }]}>
          <Text style={{ fontWeight: "700" }}>Guest Account</Text> — Read-only access to browse
          repositories, publications, and profiles.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
});
