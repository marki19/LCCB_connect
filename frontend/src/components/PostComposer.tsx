import React, { useState } from "react";
import { View, Text, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { BookOpen, FolderGit2, GraduationCap, MessageSquare } from "lucide-react-native";
import Avatar from "./Avatar";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { RADIUS, SPACE, elevation, focusRing } from "../lib/tokens";

interface PostComposerProps {
  style?: StyleProp<ViewStyle>;
  onPressPrompt?: () => void;
}

export default function PostComposer({ style, onPressPrompt }: PostComposerProps) {
  const router = useRouter();
  const { profile, isGuest } = useAuth();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  if (isGuest) return null;

  const activeName = profile?.full_name || profile?.username || "You";
  const firstName = activeName.split(" ")[0];

  const handlePrompt = () => {
    if (onPressPrompt) {
      onPressPrompt();
    } else {
      router.push("/create");
    }
  };

  return (
    <View
      style={[
        {
          padding: SPACE.x3,
          backgroundColor: colors.panel,
          borderRadius: RADIUS.xl,
          borderWidth: 1,
          borderColor: colors.line,
          ...elevation("sm", colors),
        },
        style,
      ]}
    >
      {/* Top row: Avatar + Pill Input */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Avatar name={activeName} avatarUrl={profile?.avatar_url} size={40} />
        <Pressable
          onPress={handlePrompt}
          accessibilityRole="button"
          accessibilityLabel="What's on your mind?"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={({ pressed, hovered }: any) => [
            {
              flex: 1,
              minHeight: 40,
              backgroundColor: hovered || pressed ? colors.hoverOverlay : colors.surfaceSunken,
              borderRadius: RADIUS.pill,
              borderWidth: 1,
              borderColor: colors.line,
              justifyContent: "center",
              paddingHorizontal: SPACE.x4,
              marginLeft: SPACE.x3,
              cursor: "pointer",
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
            focusRing(colors, focused),
          ]}
        >
          <Text style={{ color: colors.inkFaint, fontSize: 13 }} numberOfLines={1}>
            {`What's on your mind, ${firstName}?`}
          </Text>
        </Pressable>
      </View>

      {/* Divider line */}
      <View
        style={{
          height: 1,
          backgroundColor: colors.line,
          marginTop: SPACE.x3,
          marginBottom: SPACE.x2,
        }}
      />

      {/* Action buttons row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: SPACE.x1,
        }}
      >
        <Pressable
          onPress={() => router.push({ pathname: "/create", params: { type: "project" } })}
          accessibilityRole="button"
          accessibilityLabel="Share Project"
          accessibilityHint="Create a new project post"
          style={({ pressed, hovered }: any) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 8,
            borderRadius: RADIUS.md,
            backgroundColor: pressed || hovered ? colors.hoverOverlay : "transparent",
            cursor: "pointer",
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <FolderGit2 size={18} color={colors.success} strokeWidth={2} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>Project</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: "/create", params: { type: "capstone" } })}
          accessibilityRole="button"
          accessibilityLabel="Share Capstone"
          accessibilityHint="Create a new capstone post"
          style={({ pressed, hovered }: any) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 8,
            borderRadius: RADIUS.md,
            backgroundColor: pressed || hovered ? colors.hoverOverlay : "transparent",
            cursor: "pointer",
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <GraduationCap size={18} color={colors.warning} strokeWidth={2} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>Capstone</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: "/create", params: { type: "thesis" } })}
          accessibilityRole="button"
          accessibilityLabel="Submit Thesis"
          accessibilityHint="Submit a new thesis"
          style={({ pressed, hovered }: any) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 8,
            borderRadius: RADIUS.md,
            backgroundColor: pressed || hovered ? colors.hoverOverlay : "transparent",
            cursor: "pointer",
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <BookOpen size={18} color={colors.info} strokeWidth={2} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>Thesis</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: "/create", params: { type: "text" } })}
          accessibilityRole="button"
          accessibilityLabel="Start Discussion"
          accessibilityHint="Start a new discussion"
          style={({ pressed, hovered }: any) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 8,
            borderRadius: RADIUS.md,
            backgroundColor: pressed || hovered ? colors.hoverOverlay : "transparent",
            cursor: "pointer",
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <MessageSquare size={18} color={colors.brand} strokeWidth={2} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>Discuss</Text>
        </Pressable>
      </View>
    </View>
  );
}