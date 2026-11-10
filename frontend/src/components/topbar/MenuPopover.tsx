/**
 * MenuPopover — Facebook-style "Grid" menu.
 * Two-column layout: left = Campus navigation shortcuts, right = Create actions.
 * Anchored top-right, below the top bar.
 */

import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import {
  Home,
  BookOpen,
  GraduationCap,
  MessageCircle,
  Settings,
  FileText,
  BookMarked,
  PlusCircle,
  Users,
  Bookmark,
} from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useSettingsSidebar } from "../../contexts/SettingsSidebarContext";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import { TOP_BAR_HEIGHT } from "./constants";

interface MenuPopoverProps {
  onClose: () => void;
}

type SocialItem = {
  icon: any;
  label: string;
  desc: string;
  href?: string;
  action?: "settings";
};

type CreateItem = {
  icon: any;
  label: string;
  href: string;
};

const SOCIAL_ITEMS: SocialItem[] = [
  { icon: Home,          label: "Campus Feed",        desc: "See recent posts from campus", href: "/(tabs)/" },
  { icon: BookOpen,      label: "Repository",         desc: "Browse thesis submissions",    href: "/(tabs)/search" },
  { icon: GraduationCap, label: "Capstones",          desc: "Explore capstone projects",    href: "/(tabs)/search?tab=theses&type=capstone" },
  { icon: MessageCircle, label: "Messages",           desc: "Chat with classmates",         href: "/messages" },
  { icon: Users,         label: "Friends & Network",  desc: "Connect with peers",           href: "/friends" },
  { icon: Bookmark,      label: "Saved Posts",        desc: "View bookmarked content",      href: "/saved" },
  { icon: Settings,      label: "Settings & Privacy", desc: "Manage your account",          action: "settings" },
];

const CREATE_ITEMS: CreateItem[] = [
  { icon: PlusCircle,    label: "Share Post",       href: "/create" },
  { icon: FileText,      label: "Deposit Thesis",   href: "/upload-thesis" },
  { icon: BookMarked,    label: "Share Capstone",   href: "/create?type=capstone" },
  { icon: MessageCircle, label: "Start Discussion", href: "/create?type=discussion" },
];

export default function MenuPopover({ onClose }: MenuPopoverProps) {
  const { colors } = useTheme();
  const { openSettingsSidebar } = useSettingsSidebar();
  const router = useRouter();

  const popoverStyle =
    Platform.OS === "web"
      ? ({
          position: "fixed" as any,
          top: TOP_BAR_HEIGHT + 8,
          right: 8,
          zIndex: 1001,
        } as any)
      : { position: "absolute" as any, top: TOP_BAR_HEIGHT + 8, right: 8, zIndex: 1001 };

  const handleItemClick = (item: SocialItem | CreateItem) => {
    onClose();
    if ("action" in item && item.action === "settings") {
      openSettingsSidebar();
    } else if (item.href) {
      router.push(item.href as any);
    }
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
        },
      ]}
    >
      {/* Header */}
      <Text style={[styles.header, { color: colors.ink }]}>Menu</Text>

      <View style={styles.columns}>
        {/* LEFT — Social/Campus */}
        <View style={styles.col}>
          <Text style={[styles.colTitle, { color: colors.inkFaint }]}>
            Campus &amp; Social
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            {SOCIAL_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Pressable
                  key={item.label}
                  onPress={() => handleItemClick(item)}
                  accessibilityRole="menuitem"
                  accessibilityLabel={item.label}
                  style={({ pressed }) => [
                    styles.menuItem,
                    { backgroundColor: pressed ? colors.hoverOverlay : "transparent" },
                  ]}
                >
                  <View
                    style={[
                      styles.menuItemIcon,
                      { backgroundColor: colors.surfaceSunken },
                    ]}
                  >
                    <Icon size={18} color={colors.ink} strokeWidth={1.8} />
                  </View>
                  <View style={styles.menuItemText}>
                    <Text style={[styles.menuItemLabel, { color: colors.ink }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.menuItemDesc, { color: colors.inkFaint }]}>
                      {item.desc}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* DIVIDER */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* RIGHT — Create */}
        <View style={[styles.col, styles.colCreate]}>
          <Text style={[styles.colTitle, { color: colors.inkFaint }]}>
            Create
          </Text>
          {CREATE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.label}
                onPress={() => handleItemClick(item)}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                style={({ pressed }) => [
                  styles.createItem,
                  {
                    backgroundColor: pressed
                      ? colors.hoverOverlay
                      : colors.surfaceSunken,
                  },
                ]}
              >
                <View
                  style={[
                    styles.createIcon,
                    { backgroundColor: colors.panelInset },
                  ]}
                >
                  <Icon size={16} color={colors.ink} strokeWidth={1.8} />
                </View>
                <Text style={[styles.createLabel, { color: colors.ink }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 580,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
    overflow: "hidden",
    paddingBottom: SPACE.x3,
  },
  header: {
    ...TYPE.title,
    fontSize: 20,
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x4,
    paddingBottom: SPACE.x3,
  },
  columns: {
    flexDirection: "row",
    gap: 0,
  },
  col: {
    flex: 1,
    paddingHorizontal: SPACE.x3,
    paddingBottom: SPACE.x2,
  },
  colCreate: {
    gap: SPACE.x2,
  },
  colTitle: {
    ...TYPE.caption,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: SPACE.x2,
    paddingHorizontal: SPACE.x2,
  },
  divider: {
    width: 1,
    marginVertical: SPACE.x2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    padding: SPACE.x2,
    borderRadius: RADIUS.md,
    marginBottom: 2,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  menuItemText: {
    flex: 1,
    minWidth: 0,
  },
  menuItemLabel: {
    ...TYPE.body,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  menuItemDesc: {
    ...TYPE.caption,
    fontSize: 12,
    lineHeight: 16,
  },
  createItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    padding: SPACE.x2,
    borderRadius: RADIUS.md,
  },
  createIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  createLabel: {
    ...TYPE.body,
    fontSize: 14,
    fontWeight: "600",
  },
});

