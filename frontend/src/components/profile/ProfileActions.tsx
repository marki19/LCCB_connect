import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import {
  Plus,
  Edit3,
  UserPlus,
  UserCheck,
  Clock,
  MessageSquare,
  MoreHorizontal,
} from "lucide-react-native";
import { UserProfileData } from "../../lib/api";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface ProfileActionsProps {
  userData: UserProfileData;
  isSelf: boolean;
  onStartChat: () => void;
  onFriendAction: () => void;
  actionBusy: boolean;
  onEditProfile: () => void;
  onAddSnap?: () => void;
  onMore?: () => void;
}

export default function ProfileActions({
  userData,
  isSelf,
  onStartChat,
  onFriendAction,
  actionBusy,
  onEditProfile,
  onAddSnap,
  onMore,
}: ProfileActionsProps) {
  const { colors } = useTheme();

  if (isSelf) {
    return (
      <View style={styles.row}>
        {onAddSnap && (
          <Pressable
            onPress={onAddSnap}
            accessibilityRole="button"
            accessibilityLabel="Add a Quick Snap"
            style={({ pressed, hovered }: any) => [
              styles.actionBtn,
              {
                backgroundColor: colors.brandSolid,
                cursor: "pointer",
                opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Plus size={16} color={colors.textOnBrandSolid} strokeWidth={2.5} />
            <Text style={[styles.btnText, { color: colors.textOnBrandSolid }]}>
              Add a snap
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={onEditProfile}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          style={({ pressed, hovered }: any) => [
            styles.actionBtn,
            {
              backgroundColor: colors.surfaceSunken,
              borderColor: colors.border,
              borderWidth: 1,
              cursor: "pointer",
              opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          <Edit3 size={15} color={colors.ink} strokeWidth={2} />
          <Text style={[styles.btnText, { color: colors.ink }]}>Edit profile</Text>
        </Pressable>

        {onMore && (
          <Pressable
            onPress={onMore}
            accessibilityRole="button"
            accessibilityLabel="More options"
            style={({ pressed, hovered }: any) => [
              styles.iconBtn,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
                borderWidth: 1,
                cursor: "pointer",
                opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
              },
            ]}
          >
            <MoreHorizontal size={18} color={colors.ink} />
          </Pressable>
        )}
      </View>
    );
  }

  // Peer Profile
  const friendship = userData.friendship;
  const isFriend = friendship === "friend";
  const isPendingOut = friendship === "pending_out";
  const isPendingIn = friendship === "pending_in";

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onFriendAction}
        disabled={actionBusy}
        accessibilityRole="button"
        accessibilityLabel="Friend action"
        style={({ pressed, hovered }: any) => [
          styles.actionBtn,
          {
            backgroundColor: isFriend
              ? colors.surfaceSunken
              : isPendingOut
              ? colors.surfaceSunken
              : isPendingIn
              ? colors.brandSolid
              : colors.brandSolid,
            borderColor: isFriend || isPendingOut ? colors.border : "transparent",
            borderWidth: isFriend || isPendingOut ? 1 : 0,
            cursor: "pointer",
            opacity: pressed || actionBusy ? 0.8 : hovered ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        {actionBusy ? (
          <ActivityIndicator size="small" color={isFriend || isPendingOut ? colors.ink : "#FFFFFF"} />
        ) : isFriend ? (
          <>
            <UserCheck size={16} color={colors.ink} strokeWidth={2} />
            <Text style={[styles.btnText, { color: colors.ink }]}>Friends</Text>
          </>
        ) : isPendingOut ? (
          <>
            <Clock size={16} color={colors.inkFaint} strokeWidth={2} />
            <Text style={[styles.btnText, { color: colors.inkSoft }]}>Cancel request</Text>
          </>
        ) : isPendingIn ? (
          <>
            <UserPlus size={16} color={colors.textOnBrandSolid} strokeWidth={2} />
            <Text style={[styles.btnText, { color: colors.textOnBrandSolid }]}>Respond</Text>
          </>
        ) : (
          <>
            <UserPlus size={16} color={colors.textOnBrandSolid} strokeWidth={2} />
            <Text style={[styles.btnText, { color: colors.textOnBrandSolid }]}>Add friend</Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={onStartChat}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        style={({ pressed, hovered }: any) => [
          styles.actionBtn,
          {
            backgroundColor: isFriend ? colors.brandSolid : colors.surfaceSunken,
            borderColor: isFriend ? "transparent" : colors.border,
            borderWidth: isFriend ? 0 : 1,
            cursor: "pointer",
            opacity: pressed ? 0.8 : hovered ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <MessageSquare
          size={16}
          color={isFriend ? colors.textOnBrandSolid : colors.ink}
          strokeWidth={2}
        />
        <Text
          style={[
            styles.btnText,
            { color: isFriend ? colors.textOnBrandSolid : colors.ink },
          ]}
        >
          Message
        </Text>
      </Pressable>

      {onMore && (
        <Pressable
          onPress={onMore}
          accessibilityRole="button"
          accessibilityLabel="More options"
          style={({ pressed, hovered }: any) => [
            styles.iconBtn,
            {
              backgroundColor: colors.surfaceSunken,
              borderColor: colors.border,
              borderWidth: 1,
              cursor: "pointer",
              opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
            },
          ]}
        >
          <MoreHorizontal size={18} color={colors.ink} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
    flexWrap: "wrap",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACE.x4,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
