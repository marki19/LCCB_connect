/**
 * AccountPopover — Avatar / account menu panel.
 * Shows profile card, admin link (if admin), settings, sign out.
 */

import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Settings, Shield, LogOut } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useSettingsSidebar } from "../../contexts/SettingsSidebarContext";
import { isAdminRole, isDepartmentAdminRole } from "../../lib/roles";
import { setAdminAppPreview } from "../../lib/panelMode";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import Avatar from "../Avatar";
import { TOP_BAR_HEIGHT } from "./constants";

interface AccountPopoverProps {
  onClose: () => void;
}

export default function AccountPopover({ onClose }: AccountPopoverProps) {
  const { colors } = useTheme();
  const { profile, signOut } = useAuth();
  const { openSettingsSidebar } = useSettingsSidebar();
  const router = useRouter();

  const isAdmin = isAdminRole(profile?.role);
  const isDeptAdmin = isDepartmentAdminRole(profile?.role);

  const navigate = (href: string) => {
    onClose();
    router.push(href as any);
  };

  const handleSignOut = async () => {
    onClose();
    try { await signOut(); } catch (e) { console.error(e); }
  };

  const popoverStyle =
    Platform.OS === "web"
      ? ({
          position: "fixed" as any,
          top: TOP_BAR_HEIGHT + 8,
          right: 8,
          zIndex: 1001,
        } as any)
      : { position: "absolute" as any, top: TOP_BAR_HEIGHT + 8, right: 8, zIndex: 1001 };

  return (
    <View
      style={[
        styles.container,
        popoverStyle,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {/* Profile card */}
      <Pressable
        onPress={() => navigate("/(tabs)/profile")}
        accessibilityRole="button"
        accessibilityLabel="View your profile"
        style={({ pressed }) => [
          styles.profileCard,
          {
            backgroundColor: pressed ? colors.hoverOverlay : colors.surfaceSunken,
          },
        ]}
      >
        <Avatar
          name={profile?.full_name ?? profile?.username}
          size={48}
        />
        <View style={styles.profileText}>
          <Text style={[styles.profileName, { color: colors.ink }]} numberOfLines={1}>
            {profile?.full_name ?? profile?.username ?? "You"}
          </Text>
          <Text style={[styles.profileDept, { color: colors.inkFaint }]} numberOfLines={1}>
            {profile?.department_name ?? "No department"}
          </Text>
        </View>
      </Pressable>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Admin link */}
      {(isAdmin || isDeptAdmin) && (
        <MenuItem
          icon={<Shield size={16} color={colors.brand} strokeWidth={2} />}
          label={isAdmin ? "Admin Console" : "Moderation Console"}
          colors={colors}
          onPress={() => {
            onClose();
            if (isAdmin) {
              setAdminAppPreview(false);
              router.push("/(admin)");
            } else {
              router.push("/(moderation)" as any);
            }
          }}
        />
      )}

      {/* Settings */}
      <MenuItem
        icon={<Settings size={16} color={colors.inkSoft} strokeWidth={2} />}
        label="Settings & Privacy"
        colors={colors}
        onPress={() => {
          onClose();
          openSettingsSidebar();
        }}
      />

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Sign out */}
      <MenuItem
        icon={<LogOut size={16} color={colors.destructive} strokeWidth={2} />}
        label="Sign out"
        labelColor={colors.destructive}
        colors={colors}
        onPress={handleSignOut}
      />
    </View>
  );
}

function MenuItem({
  icon,
  label,
  labelColor,
  colors,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  colors: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: pressed ? colors.hoverOverlay : "transparent" },
      ]}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <Text
        style={[
          styles.menuLabel,
          { color: labelColor ?? colors.ink },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
    overflow: "hidden",
    paddingVertical: SPACE.x2,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    padding: SPACE.x3,
    marginHorizontal: SPACE.x2,
    marginBottom: SPACE.x2,
    borderRadius: RADIUS.md,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    ...TYPE.body,
    fontSize: 15,
    fontWeight: "700",
  },
  profileDept: {
    ...TYPE.caption,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: SPACE.x2,
    marginVertical: SPACE.x1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2,
    minHeight: 40,
  },
  menuIcon: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    ...TYPE.body,
    fontSize: 14,
    fontWeight: "500",
  },
});
