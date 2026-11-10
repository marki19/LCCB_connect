import { View, Text, FlatList, Pressable } from "react-native";
import { CapturedError, getCapturedErrors, subscribeToErrors, clearCapturedErrors } from "../lib/errorCapture";
import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { RADIUS, SPACE, TYPE, monoFamily } from "../lib/tokens";

/**
 * Developer-only overlay that lists errors captured by `lib/errorCapture`.
 * Not mounted in production screens; kept for local debugging.
 */
export function ErrorDisplay({ limit = 20 }: { limit?: number }) {
  const { colors } = useTheme();
  const [errors, setErrors] = useState<CapturedError[]>(() => getCapturedErrors().slice(0, limit));

  useEffect(() => {
    const unsub = subscribeToErrors((error) => {
      setErrors((prev) => [error, ...prev].slice(0, limit));
    });
    return unsub;
  }, [limit]);

  const renderError = ({ item }: { item: CapturedError }) => (
    <View
      style={{
        backgroundColor: colors.panel,
        padding: SPACE.x3,
        marginHorizontal: SPACE.x2,
        marginVertical: SPACE.x1,
        borderRadius: RADIUS.sm,
        borderLeftWidth: 4,
        borderLeftColor: colors.coral,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: SPACE.x1,
        }}
      >
        <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.coralText }}>
          {item.errorType.toUpperCase()}
        </Text>
        <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
      <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginBottom: SPACE.x1 }}>
        Route: {item.route}
      </Text>
      <Text style={{ ...TYPE.body, color: colors.ink, marginBottom: SPACE.x1 }}>{item.message}</Text>
      {item.stack ? (
        <Text
          numberOfLines={3}
          style={{ fontSize: 10, lineHeight: 14, fontFamily: monoFamily, color: colors.inkFaint }}
        >
          {item.stack}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: SPACE.x4,
          backgroundColor: colors.panel,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <Text style={{ ...TYPE.title, color: colors.ink }}>
          {errors.length === 0 ? "No errors captured" : `Captured errors (${errors.length})`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear captured errors"
          onPress={() => clearCapturedErrors()}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: SPACE.x1 })}
        >
          <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.coralText }}>
            {errors.length === 0 ? "Clear all" : "Clear"}
          </Text>
        </Pressable>
      </View>
      <FlatList data={errors} renderItem={renderError} keyExtractor={(item) => item.id} inverted />
    </View>
  );
}
