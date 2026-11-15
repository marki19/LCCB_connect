import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { RefreshCw } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { focusRing, RADIUS, SPACE, TYPE } from "../../lib/tokens";

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
  const spinAnim = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (refreshing) {
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      loop.start();
      return () => loop.stop();
    } else {
      Animated.timing(spinAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: false,
      }).start();
    }
  }, [refreshing, spinAnim]);

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={refreshing ? `${label} — loading` : label}
      accessibilityState={{ busy: refreshing }}
      onPress={onRefresh}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          minHeight: 40,
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
      <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
        <RefreshCw size={15} color={colors.inkSoft} />
      </Animated.View>
      <Text style={{ ...TYPE.bodyStrong, color: colors.inkSoft }}>{label}</Text>
    </Pressable>
  );
}

// no local state helper needed

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
        <Text style={{ ...TYPE.micro, color: colors.inkFaint, marginBottom: SPACE.x3 }}>
          {eyebrow}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: SPACE.x4,
        }}
      >
        <View style={{ flexGrow: 1, flexShrink: 1, minWidth: 240, maxWidth: 780 }}>
          <Text
            accessibilityRole="header"
            style={{
              ...TYPE.h1,
              fontSize: compact ? 28 : TYPE.h1.fontSize,
              lineHeight: compact ? 34 : TYPE.h1.lineHeight,
              color: colors.ink,
            }}
          >
            {title}
          </Text>
          {description ? (
            <Text
              style={{
                ...TYPE.body,
                color: colors.inkSoft,
                marginTop: SPACE.x2,
                maxWidth: 660,
              }}
            >
              {description}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2, flexWrap: "wrap" }}>
          {actions}
          {onRefresh ? (
            <RefreshButton onRefresh={onRefresh} refreshing={refreshing} label={refreshLabel} />
          ) : null}
        </View>
      </View>

      <View
        style={{
          marginTop: SPACE.x5,
          height: 1,
          backgroundColor: colors.line,
        }}
      />

      {meta ? (
        <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: SPACE.x3 }}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}
