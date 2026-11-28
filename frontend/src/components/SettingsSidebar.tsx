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
  StatusBar,
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
          width: "100%",
          minHeight: 46,
          paddingVertical: SPACE.x2,
          paddingHorizontal: SPACE.x4,
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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          gap: SPACE.x3,
        }}
      >
        {icon}
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            flexShrink: 1,
            ...TYPE.bodyStrong,
            fontWeight: "500",
            color: danger ? colors.destructive : colors.ink,
          }}
        >
          {label}
        </Text>
        {!danger && <ChevronRight size={16} color={colors.inkFaint} />}
      </View>
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
  const topInset = Math.max(
    insets.top,
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0
  );
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
        {/* Streamlined Profile Header on panel background */}
        <View
          style={{
            paddingTop: topInset + SPACE.x3,
            paddingHorizontal: SPACE.x4,
            paddingBottom: SPACE.x3,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: SPACE.x3,
            }}
          >
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
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.x3,
                minWidth: 0,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Avatar
                name={displayName}
                avatarUrl={profile?.avatar_url}
                size={42}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{ ...TYPE.bodyStrong, color: colors.ink, fontWeight: "700" }}
                >
                  {displayName}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ ...TYPE.caption, color: colors.inkSoft, marginTop: 1 }}
                >
                  {profile?.department_name || "No department"} · {profile?.year_level || "—"}
                </Text>
              </View>
            </Pressable>

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
                backgroundColor: colors.surfaceSunken,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <X size={18} color={colors.ink} />
            </Pressable>
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
