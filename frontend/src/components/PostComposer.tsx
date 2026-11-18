import React from "react";
import { View, Text, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { FolderGit2, GraduationCap, Image as ImageIcon, MessageSquare } from "lucide-react-native";
import Avatar from "./Avatar";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { RADIUS, SPACE, elevation } from "../lib/tokens";

interface PostComposerProps {
  style?: StyleProp<ViewStyle>;
  onPressPrompt?: () => void;
}

export default function PostComposer({ style, onPressPrompt }: PostComposerProps) {
  const router = useRouter();
  const { profile, isGuest } = useAuth();
  const { colors } = useTheme();

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
          style={({ pressed, hovered }: any) => ({
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
          })}
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
          onPress={() => router.push({ pathname: "/create", params: { editType: "project" } })}
          accessibilityRole="button"
          accessibilityLabel="Share Project"
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
          <FolderGit2 size={18} color="#10B981" strokeWidth={2} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.inkSoft }}>Project</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: "/create", params: { editType: "capstone" } })}
          accessibilityRole="button"
          accessibilityLabel="Share Capstone"
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
          <GraduationCap size={18} color="#F59E0B" strokeWidth={2} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.inkSoft }}>Capstone</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: "/create", params: { editType: "image" } })}
          accessibilityRole="button"
          accessibilityLabel="Share Photo"
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
          <ImageIcon size={18} color="#8B5CF6" strokeWidth={2} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.inkSoft }}>Photo</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push({ pathname: "/create", params: { editType: "text" } })}
          accessibilityRole="button"
          accessibilityLabel="Start Discussion"
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
          <MessageSquare size={18} color="#3B82F6" strokeWidth={2} />
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.inkSoft }}>Discuss</Text>
        </Pressable>
      </View>
    </View>
  );
}
