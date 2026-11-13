import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { RefreshCw } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { focusRing, RADIUS, SPACE } from "../../lib/tokens";
import { CONSOLE_TEXT } from "./consoleTheme";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: string;
  actions?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshLabel?: string;
};

function RefreshButton({
  onRefresh,
  refreshing = false,
  label = "Refresh",
}: {
  onRefresh: () => void;
  refreshing?: boolean;
  label?: string;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const rotation = useSharedValue(0);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (refreshing && !reduced) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      rotation.value = withTiming(0, { duration: 120 });
    }
  }, [refreshing, reduced, rotation]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={refreshing ? `${label}, loading` : label}
      accessibilityState={{ busy: refreshing }}
      onPress={onRefresh}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          minHeight: 38,
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x2,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: hovered || focused ? colors.lineStrong : colors.line,
          backgroundColor: hovered || focused ? colors.panelInset : colors.panel,
          paddingHorizontal: SPACE.x4,
          paddingVertical: SPACE.x2,
        },
        focusRing(colors, focused),
      ]}
    >
      <Animated.View style={spin}>
        <RefreshCw size={14} color={colors.inkSoft} />
      </Animated.View>
      <Text style={{ ...CONSOLE_TEXT.strong, fontSize: 13, color: colors.inkSoft }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Console page header: one title, one short description, and the page actions
 * on the same line so every screen opens the same way.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  onRefresh,
  refreshing = false,
  refreshLabel = "Refresh",
}: PageHeaderProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 760;

  return (
    <View style={{ marginBottom: compact ? SPACE.x6 : SPACE.x8 }}>
      {eyebrow ? (
        <Text
          style={{
            ...CONSOLE_TEXT.eyebrow,
            fontSize: 10.5,
            color: colors.inkFaint,
            marginBottom: SPACE.x2,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: SPACE.x4,
        }}
      >
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 260, maxWidth: 720 }}>
          <Text
            accessibilityRole="header"
            style={{
              ...CONSOLE_TEXT.pageTitle,
              fontSize: compact ? 25 : CONSOLE_TEXT.pageTitle.fontSize,
              lineHeight: compact ? 32 : CONSOLE_TEXT.pageTitle.lineHeight,
              color: colors.ink,
            }}
          >
            {title}
          </Text>
          {description ? (
            <Text
              style={{
                ...CONSOLE_TEXT.body,
                color: colors.inkSoft,
                marginTop: SPACE.x2,
                maxWidth: 620,
              }}
            >
              {description}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.x2,
            flexWrap: "wrap",
            paddingTop: compact ? 0 : 4,
          }}
        >
          {actions}
          {onRefresh ? (
            <RefreshButton onRefresh={onRefresh} refreshing={refreshing} label={refreshLabel} />
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: SPACE.x5, height: 1, backgroundColor: colors.line }} />

      {meta ? (
        <Text
          style={{
            ...CONSOLE_TEXT.caption,
            fontSize: 12,
            color: colors.inkFaint,
            marginTop: SPACE.x3,
          }}
        >
          {meta}
        </Text>
      ) : null}
    </View>
  );
}
