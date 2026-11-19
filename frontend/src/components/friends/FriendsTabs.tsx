import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";

export type FriendsTab = "requests" | "suggestions" | "all";

type FriendsTabsProps = {
  value: FriendsTab;
  onChange: (tab: FriendsTab) => void;
  counts?: Partial<Record<FriendsTab, number>>;
};

const TABS: readonly { id: FriendsTab; label: string }[] = [
  { id: "requests", label: "Requests" },
  { id: "suggestions", label: "Suggestions" },
  { id: "all", label: "All friends" },
];

/**
 * In-page section switch for the Friends screen.
 *
 * Horizontal pills rather than a second sidebar: the app's own left rail is
 * already the navigation for this shell, so the page only needs to switch
 * between its three lists.
 */
export default function FriendsTabs({ value, onChange, counts = {} }: FriendsTabsProps) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: SPACE.x2, paddingVertical: SPACE.x1 }}
      accessibilityRole="tablist"
    >
      {TABS.map((tab) => {
        const active = value === tab.id;
        const count = counts[tab.id] ?? 0;

        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityLabel={count > 0 ? `${tab.label}, ${count}` : tab.label}
            accessibilityState={{ selected: active }}
            style={({ pressed, hovered }: any) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.x2,
                minHeight: 36,
                paddingHorizontal: SPACE.x4,
                borderRadius: RADIUS.pill,
                borderWidth: 1,
                borderColor: active ? "transparent" : colors.border,
                backgroundColor: active
                  ? colors.brandSolid
                  : pressed || hovered
                  ? colors.surfaceSunken
                  : colors.surface,
                cursor: "pointer",
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text
              style={{
                ...TYPE.caption,
                fontSize: 13,
                fontWeight: "700",
                color: active ? colors.textOnBrandSolid : colors.textSecondary,
              }}
            >
              {tab.label}
            </Text>

            {count > 0 ? (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  paddingHorizontal: 5,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? colors.textOnBrandSolid : colors.brandWash,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "800",
                    color: active ? colors.brandSolid : colors.brand,
                  }}
                >
                  {count > 99 ? "99+" : count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
