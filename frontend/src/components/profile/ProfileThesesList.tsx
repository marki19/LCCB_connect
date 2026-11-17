import React from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
} from "react-native";
import { BookOpen } from "lucide-react-native";
import { getThesisFileUrl } from "../../lib/api";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface ProfileThesesListProps {
  theses: any[];
  loading: boolean;
}

export default function ProfileThesesList({
  theses,
  loading,
}: ProfileThesesListProps) {
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (theses.length === 0) {
    return (
      <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSunken }]}>
          <BookOpen size={32} color={colors.inkFaint} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.ink }]}>No manuscripts deposited</Text>
        <Text style={[styles.emptySubtitle, { color: colors.inkFaint }]}>
          No thesis or capstone manuscripts are publicly associated with this profile.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {theses.map((item) => (
        <View
          key={item.id}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.title, { color: colors.ink }]}>{item.title}</Text>
          {item.abstract ? (
            <Text style={[styles.abstract, { color: colors.inkSoft }]} numberOfLines={3}>
              {item.abstract}
            </Text>
          ) : null}

          <Pressable
            onPress={async () => {
              if (!item.pdf_url) return;
              try {
                const url = await getThesisFileUrl(item.id);
                await Linking.openURL(url);
              } catch (e: any) {
                Alert.alert("Error", e.message || "Failed to open manuscript");
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Read manuscript"
            style={({ pressed, hovered }: any) => [
              styles.readBtn,
              {
                backgroundColor: colors.brandWash,
                borderColor: colors.brand,
                cursor: "pointer",
                opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <BookOpen size={15} color={colors.brand} style={{ marginRight: 6 }} />
            <Text style={[styles.readBtnText, { color: colors.brand }]}>Read Manuscript</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    paddingVertical: SPACE.x8,
    alignItems: "center",
  },
  emptyBox: {
    padding: SPACE.x8,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.x3,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 320,
    marginTop: 4,
  },
  list: {
    gap: SPACE.x3,
  },
  card: {
    padding: SPACE.x4,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  abstract: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: SPACE.x3,
  },
  readBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: SPACE.x3,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  readBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
});
