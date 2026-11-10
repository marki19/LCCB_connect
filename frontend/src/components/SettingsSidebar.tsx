import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
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
  Palette,
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

const DESKTOP_SIDEBAR_WIDTH = 360;
const MOBILE_SIDEBAR_RATIO = 0.82;
const MOBILE_SIDEBAR_MAX_WIDTH = 380;

interface SettingsSidebarProps {
  visible?: boolean;
  onClose?: () => void;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onPress?: () => void;
}

function MenuItem({ icon, label, danger, onPress }: MenuItemProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 13,
        paddingHorizontal: 18,
      }}
    >
      {icon}
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: "500",
          color: danger ? colors.destructive : colors.textPrimary,
          marginLeft: 14,
        }}
      >
        {label}
      </Text>
      {!danger && <ChevronRight size={16} color={colors.textTertiary} />}
    </TouchableOpacity>
  );
}

function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        color: colors.textTertiary,
        letterSpacing: 0.8,
        paddingHorizontal: 18,
        paddingTop: 20,
        paddingBottom: 6,
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
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15,23,42,0.45)",
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
          backgroundColor: colors.surface,
          transform: [{ translateX }],
          shadowColor: "#000",
          shadowOffset: { width: 4, height: 0 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 25,
        }}
      >
        {/* Header Profile Section */}
        <View
          style={{
            paddingTop: insets.top + 14,
            paddingHorizontal: 18,
            paddingBottom: 20,
            backgroundColor: isDark ? "hsl(215, 35%, 15%)" : "#1A56DB",
            borderBottomWidth: isDark ? 1 : 0,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={{ alignSelf: "flex-end", marginBottom: 14 }}
            accessibilityLabel="Close settings sidebar"
          >
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: colors.actionSurfaceAlt,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
                borderWidth: 2,
                borderColor: "rgba(255,255,255,0.4)",
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "800", color: colors.textPrimary }}>
                {getInitials(displayName)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }} numberOfLines={1}>
                {profile?.department_name || "LCCB Campus"} · {profile?.year_level || "Student"}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {/* Account */}
          <SectionLabel label="Account & Saved" />
          <MenuItem
            icon={<UserCircle size={20} color={colors.action} />}
            label="Edit Profile"
            onPress={() => go("/edit-profile")}
          />
          <MenuItem
            icon={<Bookmark size={20} color="#8B5CF6" />}
            label="Saved Posts"
            onPress={() => go("/saved")}
          />

          {/* Social */}
          <SectionLabel label="Social & Messaging" />
          <MenuItem
            icon={<Users size={20} color={colors.action} />}
            label="Friends & Requests"
            onPress={() => go("/friends")}
          />
          <MenuItem
            icon={<MessageSquare size={20} color={colors.action} />}
            label="Messages"
            onPress={() => go("/messages")}
          />

          {/* App Preferences */}
          <SectionLabel label="Preferences" />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 10,
              paddingHorizontal: 18,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {isDark ? <Moon size={20} color={colors.action} /> : <Sun size={20} color={colors.action} />}
              <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textPrimary, marginLeft: 14 }}>
                Dark Mode
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={() => void toggleTheme()}
              trackColor={{ false: colors.borderStrong, true: colors.action }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Divider & Sign out */}
          <View style={{ height: 1, backgroundColor: colors.border, marginTop: 24, marginHorizontal: 18 }} />
          {!isGuest && (
            <MenuItem
              icon={<LogOut size={20} color={colors.destructive} />}
              label="Sign Out"
              danger
              onPress={handleSignOut}
            />
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
