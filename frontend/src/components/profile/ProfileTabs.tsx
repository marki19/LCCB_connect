import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { SPACE } from "../../lib/tokens";

export type ProfileTabKey = "all" | "about" | "friends" | "photos" | "theses";

interface ProfileTabsProps {
  activeTab: ProfileTabKey;
  onTabChange: (tab: ProfileTabKey) => void;
  thesesCount?: number;
  friendsCount?: number;
}

export default function ProfileTabs({
  activeTab,
  onTabChange,
  thesesCount = 0,
  friendsCount = 0,
}: ProfileTabsProps) {
  const { colors } = useTheme();

  const tabs: { key: ProfileTabKey; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "about", label: "About" },
    { key: "friends", label: "Friends", count: friendsCount },
    { key: "photos", label: "Photos" },
    { key: "theses", label: "Theses", count: thesesCount },
  ];

  return (
    <View style={[styles.container, { borderBottomColor: colors.line }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onTabChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={({ pressed, hovered }: any) => [
                styles.tabItem,
                {
                  cursor: "pointer",
                  backgroundColor: pressed || hovered ? colors.hoverOverlay : "transparent",
                },
              ]}
            >
              <View style={styles.labelRow}>
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive ? colors.brand : colors.inkSoft,
                      fontWeight: isActive ? "800" : "600",
                    },
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.count !== undefined && tab.count > 0 && tab.key !== "all" && tab.key !== "about" ? (
                  <Text style={[styles.countBadge, { color: colors.inkFaint }]}>
                    {tab.count}
                  </Text>
                ) : null}
              </View>

              {isActive && (
                <View style={[styles.activeUnderline, { backgroundColor: colors.brand }]} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    marginTop: SPACE.x2,
    paddingHorizontal: SPACE.x2,
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x1,
  },
  tabItem: {
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
    position: "relative",
    borderRadius: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tabLabel: {
    fontSize: 15,
  },
  countBadge: {
    fontSize: 13,
    fontWeight: "500",
  },
  activeUnderline: {
    position: "absolute",
    bottom: 0,
    left: SPACE.x4,
    right: SPACE.x4,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
});
