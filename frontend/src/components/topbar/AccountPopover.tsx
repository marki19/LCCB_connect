/**
 * AccountPopover — Avatar / account menu panel.
 *
 * Panel 0 is the menu (profile card, admin link, settings, theme, sign out).
 * Choosing "Theme" slides panel 1 in from the right; its back arrow returns.
 */

import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, ChevronRight, LogOut, Palette, Settings, Shield } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useSettingsSidebar } from "../../contexts/SettingsSidebarContext";
import { isAdminRole, isDepartmentAdminRole } from "../../lib/roles";
import { colorSchemeLabel } from "../../lib/theme";
import { setAdminAppPreview } from "../../lib/panelMode";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import Avatar from "../Avatar";
import ThemeOptions from "../settings/ThemeOptions";
import SlideSwitcher from "../ui/SlideSwitcher";
import { usePopoverPosition, getArrowStyle, getBorderArrowStyle } from "../../lib/popoverPosition";

/** Outer width of the panel, including its 1px border. */
const POPOVER_WIDTH = 280;
const POPOVER_BORDER = 1;
/** Width that one panel (and therefore one slide step) occupies. */
const PANEL_WIDTH = POPOVER_WIDTH - POPOVER_BORDER * 2;

type AccountPanel = "menu" | "theme";

interface AccountPopoverProps {
  onClose: () => void;
  /** Anchor element ref for positioning */
  anchorRef?: React.RefObject<any>;
}

export default function AccountPopover({ 
  onClose,
  anchorRef,
}: AccountPopoverProps) {
  const { colors, preference } = useTheme();
  const { profile, signOut } = useAuth();
  const { height: windowHeight } = useWindowDimensions();
  const { openSettingsSidebar } = useSettingsSidebar();
  const router = useRouter();

  const [panel, setPanel] = useState<AccountPanel>("menu");

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

  // The theme sub-panel needs more vertical room than the menu panel. Size the
  // card to fit all accent swatches at once (no scrolling) while staying inside
  // short viewports.
  const maxPopoverHeight = Math.min(640, Math.max(420, windowHeight - 96));

  // Use the new popover positioning hook (anchored to the trigger button)
  const { position, arrowPosition, arrowOffset, updatePosition } = usePopoverPosition({
    preferredPosition: "bottom-end",
    popoverWidth: POPOVER_WIDTH,
    popoverHeight: maxPopoverHeight,
    enabled: true,
  }, anchorRef);

  // Trigger position update when anchor is ready
  useEffect(() => {
    updatePosition();
  }, [updatePosition, anchorRef]);

  if (!position) {
    return null;
  }

  const popoverStyle = {
    position: "absolute" as const,
    top: position.top,
    left: position.left,
    zIndex: 1001,
  };

  return (
    <View
      style={[
        styles.container,
        popoverStyle,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
          maxHeight: maxPopoverHeight,
        },
      ]}
    >
      {/* Arrow indicator */}
      {arrowPosition && (
        <>
          <View
            style={getBorderArrowStyle(arrowPosition, arrowOffset, colors.border)}
            accessible={false}
            accessibilityElementsHidden={true}
            importantForAccessibility="no-hide-descendants"
          />
          <View
            style={getArrowStyle(arrowPosition, arrowOffset, colors.surface)}
            accessible={false}
            accessibilityElementsHidden={true}
            importantForAccessibility="no-hide-descendants"
          />
        </>
      )}

      <SlideSwitcher index={panel === "theme" ? 1 : 0} width={PANEL_WIDTH}>
        {/* ── Panel 0: account menu ── */}
        <View>
          {/* Profile card */}
          <Pressable
            onPress={() => {
              if (profile?.id) {
                navigate(`/profile/${profile.id}`);
              } else {
                navigate("/(tabs)/profile");
              }
            }}
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
              avatarUrl={profile?.avatar_url}
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

          {/* Theme */}
          <MenuItem
            icon={<Palette size={16} color={colors.inkSoft} strokeWidth={2} />}
            label="Theme"
            colors={colors}
            accessibilityHint="Opens appearance options"
            trailing={
              <>
                <Text style={[styles.menuValue, { color: colors.inkFaint }]}>
                  {colorSchemeLabel(preference)}
                </Text>
                <ChevronRight size={14} color={colors.inkFaint} strokeWidth={2} />
              </>
            }
            onPress={() => setPanel("theme")}
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

        {/* ── Panel 1: theme ── */}
        <View>
          <View style={styles.panelHeader}>
            <Pressable
              onPress={() => setPanel("menu")}
              accessibilityRole="button"
              accessibilityLabel="Back to account menu"
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: pressed ? colors.hoverOverlay : "transparent" },
              ]}
            >
              <ArrowLeft size={18} color={colors.ink} strokeWidth={2.2} />
            </Pressable>
            <Text style={[styles.panelTitle, { color: colors.ink }]}>Theme</Text>
          </View>

          <ThemeOptions />
        </View>
      </SlideSwitcher>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  labelColor,
  trailing,
  accessibilityHint,
  colors,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  /** Optional right-aligned content, e.g. the current theme name + chevron. */
  trailing?: React.ReactNode;
  accessibilityHint?: string;
  colors: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: pressed ? colors.hoverOverlay : "transparent" },
      ]}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <Text
        numberOfLines={1}
        style={[
          styles.menuLabel,
          { color: labelColor ?? colors.ink },
        ]}
      >
        {label}
      </Text>
      {trailing ? <View style={styles.menuTrailing}>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: POPOVER_WIDTH,
    borderRadius: RADIUS.lg,
    borderWidth: POPOVER_BORDER,
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
    flex: 1,
  },
  menuTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x1,
  },
  menuValue: {
    ...TYPE.caption,
    fontSize: 12,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
    paddingHorizontal: SPACE.x2,
    paddingTop: SPACE.x1,
    paddingBottom: SPACE.x2,
  },
  backButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  panelTitle: {
    ...TYPE.title,
    fontSize: 17,
  },
});