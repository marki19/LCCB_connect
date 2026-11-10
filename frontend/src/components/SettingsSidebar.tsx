import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Switch,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  X,
  UserCircle,
  Shield,
  Lock,
  Palette,
  BellRing,
  School,
  Flag,
  LogOut,
  ChevronRight,
  Users,
  MessageSquare,
  Sun,
  Moon,
  Bookmark,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useSettingsSidebar } from "../contexts/SettingsSidebarContext";
import { supabase } from "../lib/supabase";
import { elevation, focusRing, RADIUS, SPACE, TYPE } from "../lib/tokens";

const DESKTOP_SIDEBAR_WIDTH = 360;
const MOBILE_SIDEBAR_RATIO = 0.82;
const MOBILE_SIDEBAR_MAX_WIDTH = 380;

type SettingsSidebarProps = {
  visible?: boolean;
  onClose?: () => void;
};

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onPress?: () => void;
};

function MenuItem({ icon, label, danger, onPress }: MenuItemProps) {
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          minHeight: 46,
          paddingVertical: SPACE.x2,
          paddingHorizontal: SPACE.x4,
          gap: SPACE.x3,
          backgroundColor: hovered || focused ? colors.panelInset : "transparent",
        },
        focusRing(colors, focused),
      ]}
    >
      {icon}
      <Text
        style={{
          flex: 1,
          ...TYPE.bodyStrong,
          fontWeight: "500",
          color: danger ? colors.destructive : colors.ink,
        }}
      >
        {label}
      </Text>
      {!danger && <ChevronRight size={16} color={colors.inkFaint} />}
    </Pressable>
  );
}

function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        ...TYPE.micro,
        color: colors.inkFaint,
        paddingHorizontal: SPACE.x4,
        paddingTop: SPACE.x5,
        paddingBottom: SPACE.x2,
        textTransform: "uppercase",
      }}
    >
      {label}
    </Text>
  );
}

export default function SettingsSidebar(props: SettingsSidebarProps) {
  const sidebarContext = useSettingsSidebar();
  const visible = props.visible !== undefined ? props.visible : sidebarContext.isSettingsSidebarOpen;
  const onClose = props.onClose || sidebarContext.closeSettingsSidebar;

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors, isDark, toggleTheme } = useTheme();
  const { profile, isGuest } = useAuth();

  const sidebarWidth =
    Platform.OS === "web" && width >= 768
      ? DESKTOP_SIDEBAR_WIDTH
      : Math.min(MOBILE_SIDEBAR_MAX_WIDTH, Math.round(width * MOBILE_SIDEBAR_RATIO));

  const [translateX] = useState(() => new Animated.Value(-sidebarWidth));
  const [backdrop] = useState(() => new Animated.Value(0));

  const displayName = profile?.full_name || (isGuest ? "Guest Visitor" : "User");

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: visible ? 0 : -sidebarWidth,
        useNativeDriver: true,
        damping: 22,
        stiffness: 200,
      }),
      Animated.timing(backdrop, {
        toValue: visible ? 1 : 0,
        duration: visible ? 250 : 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdrop, sidebarWidth, translateX, visible]);

  const handleSignOut = async () => {
    onClose();
    await supabase.auth.signOut();
  };

  const go = (path: string) => {
    onClose();
    router.push(path as any);
  };

  return (
    <View
      pointerEvents={visible ? "box-none" : "none"}
      style={{
        position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1500,
      }}
    >
      <TouchableWithoutFeedback onPress={onClose} accessibilityLabel="Close menu">
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.scrim,
            opacity: backdrop,
          }}
        />
      </TouchableWithoutFeedback>

      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: sidebarWidth,
          backgroundColor: colors.panel,
          transform: [{ translateX }],
          borderRightWidth: 1,
          borderRightColor: colors.line,
          ...elevation("lg", colors),
        }}
      >
        {/* Brand header */}
        <View
          style={{
            paddingTop: insets.top + SPACE.x3,
            paddingHorizontal: SPACE.x4,
            paddingBottom: SPACE.x5,
            backgroundColor: colors.brandSolid,
            borderBottomWidth: 1,
            borderBottomColor: colors.heroLine,
          }}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            style={({ pressed }) => ({
              alignSelf: "flex-end",
              width: 36,
              height: 36,
              borderRadius: RADIUS.md,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.heroLine,
              marginBottom: SPACE.x4,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <X size={20} color={colors.heroText} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x3 }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: colors.heroLine,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: colors.heroText,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.heroText }}>
                {getInitials(displayName)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ ...TYPE.title, color: colors.heroText, fontWeight: "700" }}
              >
                {displayName}
              </Text>
              <Text
                numberOfLines={1}
                style={{ ...TYPE.caption, color: colors.heroTextMuted, marginTop: 2 }}
              >
                {profile?.department_name || "No department"} · {profile?.year_level || "—"}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.x5 }}
        >
          <SectionLabel label="Account & Saved" />
          <MenuItem
            icon={<UserCircle size={20} color={colors.brand} />}
            label="Edit profile"
            onPress={() => go("/edit-profile")}
          />
          <MenuItem
            icon={<Bookmark size={20} color={colors.brand} />}
            label="Saved posts"
            onPress={() => go("/saved")}
          />
          <MenuItem
            icon={<Shield size={20} color={colors.brand} />}
            label="Privacy"
            onPress={() => go("/settings")}
          />
          <MenuItem icon={<Lock size={20} color={colors.brand} />} label="Security" />

          <SectionLabel label="Messages" />
          <MenuItem
            icon={<MessageSquare size={20} color={colors.brand} />}
            label="Messages"
            onPress={() => go("/messages")}
          />
          <MenuItem
            icon={<Users size={20} color={colors.brand} />}
            label="Friends & requests"
            onPress={() => go("/friends")}
          />
          <MenuItem
            icon={<Shield size={20} color={colors.brand} />}
            label="Messaging & presence"
            onPress={() => go("/settings")}
          />

          {/* App Preferences */}
          <SectionLabel label="Preferences" />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: SPACE.x2,
              paddingHorizontal: SPACE.x4,
              minHeight: 46,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x3 }}>
              {isDark ? (
                <Moon size={20} color={colors.brand} />
              ) : (
                <Sun size={20} color={colors.brand} />
              )}
              <Text style={{ ...TYPE.bodyStrong, fontWeight: "500", color: colors.ink }}>
                Dark mode
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={() => void toggleTheme()}
              accessibilityLabel="Dark mode"
              trackColor={{ false: colors.borderStrong, true: colors.brand }}
              thumbColor={colors.textOnBrandSolid}
            />
          </View>
          <MenuItem
            icon={<Palette size={20} color={colors.brand} />}
            label="Appearance"
            onPress={() => go("/settings")}
          />
          <MenuItem icon={<BellRing size={20} color={colors.brand} />} label="Notifications" />

          <SectionLabel label="Institution" />
          <MenuItem icon={<School size={20} color={colors.brand} />} label="About LCCB" />
          <MenuItem icon={<Flag size={20} color={colors.brand} />} label="Report an issue" />

          <View
            style={{
              height: 1,
              backgroundColor: colors.divider,
              marginTop: SPACE.x5,
              marginHorizontal: SPACE.x4,
            }}
          />
          <MenuItem
            icon={<LogOut size={20} color={colors.destructive} />}
            label="Sign out"
            danger
            onPress={handleSignOut}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
}
