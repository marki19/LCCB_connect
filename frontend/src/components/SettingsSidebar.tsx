import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Linking,
  Alert,
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
  MessageCircle,
  Bookmark,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useSettingsSidebar } from "../contexts/SettingsSidebarContext";
import { canAccessAdminPanel } from "../lib/roles";
import { elevation, focusRing, SPACE, TYPE } from "../lib/tokens";
import SecuritySettingsModal from "./settings/SecuritySettingsModal";
import Avatar from "./Avatar";

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
      style={({ pressed }: any) => [
        {
          flexDirection: "row",
          alignItems: "center",
          minHeight: 46,
          paddingVertical: SPACE.x2,
          paddingHorizontal: SPACE.x4,
          gap: SPACE.x3,
          cursor: "pointer",
          backgroundColor: pressed
            ? colors.hoverOverlay
            : hovered || focused
            ? colors.panelInset
            : "transparent",
          transform: [{ scale: pressed ? 0.98 : 1 }],
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
  const { colors } = useTheme();
  const { profile, isGuest, signOut } = useAuth();

  const sidebarWidth =
    Platform.OS === "web" && width >= 768
      ? DESKTOP_SIDEBAR_WIDTH
      : Math.min(MOBILE_SIDEBAR_MAX_WIDTH, Math.round(width * MOBILE_SIDEBAR_RATIO));

  const [translateX] = useState(() => new Animated.Value(-sidebarWidth));
  const [backdrop] = useState(() => new Animated.Value(0));
  const [securityModalOpen, setSecurityModalOpen] = useState(false);

  const displayName = profile?.full_name || (isGuest ? "Guest Visitor" : "User");
  const canOpenAdminPanel = canAccessAdminPanel(profile?.role);

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
    await signOut();
  };

  const go = (path: string) => {
    onClose();
    router.push(path as any);
  };

  return (
    <View
      pointerEvents="box-none"
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
          pointerEvents={visible ? "auto" : "none"}
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
        {/* Profile header */}
        <View
          style={{
            position: "relative",
            overflow: "hidden",
            paddingTop: insets.top + SPACE.x3,
            paddingHorizontal: SPACE.x4,
            paddingBottom: SPACE.x5,
            backgroundColor: colors.brandSolid,
            borderBottomWidth: 1,
            borderBottomColor: colors.heroLine,
          }}
        >
          {/* Soft brand blooms — mirrors the profile hero band so the drawer
              reads as part of the same family rather than a flat blue bar. */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: colors.heroGlow,
              opacity: 0.22,
              top: -120,
              right: -70,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 150,
              height: 150,
              borderRadius: 75,
              backgroundColor: colors.accentBright,
              opacity: 0.12,
              bottom: -100,
              left: -40,
            }}
          />

          {/* Context row: names the drawer, keeps the close button in reach */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: SPACE.x4,
            }}
          >
            <Text style={{ ...TYPE.micro, color: colors.heroTextMuted }}>
              Settings &amp; privacy
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.heroLine,
                borderWidth: 1,
                borderColor: colors.heroLine,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <X size={18} color={colors.heroText} />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View your profile"
            onPress={() => {
              if (profile?.id) {
                go(`/profile/${profile.id}`);
              } else {
                go("/(tabs)/profile");
              }
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.x3,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{
                width: 62,
                height: 62,
                borderRadius: 31,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.heroLine,
                borderWidth: 1,
                borderColor: colors.heroLine,
              }}
            >
              <Avatar
                name={displayName}
                avatarUrl={profile?.avatar_url}
                size={54}
              />
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
            <ChevronRight size={18} color={colors.heroTextMuted} />
          </Pressable>
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
          <MenuItem
            icon={<Lock size={20} color={colors.brand} />}
            label="Security"
            onPress={() => {
              onClose();
              setSecurityModalOpen(true);
            }}
          />

          <SectionLabel label="Messages" />
          <MenuItem
            icon={<MessageCircle size={20} color={colors.brand} />}
            label="Messages"
            onPress={() => go("/(tabs)/messages")}
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

          {canOpenAdminPanel ? (
            <>
              <SectionLabel label="Administration" />
              <MenuItem
                icon={<Shield size={20} color={colors.brand} />}
                label="Admin console"
                onPress={() => go("/(admin)")}
              />
            </>
          ) : null}

          {/* App Preferences */}
          <SectionLabel label="Preferences" />
          <MenuItem
            icon={<Palette size={20} color={colors.brand} />}
            label="Appearance"
            onPress={() => go("/settings")}
          />
          <MenuItem
            icon={<BellRing size={20} color={colors.brand} />}
            label="Notifications"
            onPress={() => go("/(tabs)/notifications")}
          />

          <SectionLabel label="Institution" />
          <MenuItem
            icon={<School size={20} color={colors.brand} />}
            label="About LCCB"
            onPress={() => {
              onClose();
              void Linking.openURL("https://lccbonline.edu.ph");
            }}
          />
          <MenuItem
            icon={<Flag size={20} color={colors.brand} />}
            label="Report an issue"
            onPress={() => {
              onClose();
              Alert.alert(
                "Report an Issue",
                "Found a bug or need assistance? Email campus support at itsupport@lccbonline.edu.ph.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Send Email",
                    onPress: () => {
                      void Linking.openURL(
                        "mailto:itsupport@lccbonline.edu.ph?subject=LCCB%20Connect%20Issue%20Report"
                      );
                    },
                  },
                ]
              );
            }}
          />

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

      <SecuritySettingsModal
        visible={securityModalOpen}
        onClose={() => setSecurityModalOpen(false)}
      />
    </View>
  );
}
