import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Animated, Dimensions, ScrollView, TouchableWithoutFeedback, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, UserCircle, Shield, Lock, Palette, BellRing, School, Flag, LogOut, ChevronRight, Users, MessageSquare, Sun, Moon } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

import { useTheme } from "../contexts/ThemeContext";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;

type Props   = { visible: boolean; onClose: () => void };
type MenuItemProps = { icon: React.ReactNode; label: string; danger?: boolean; onPress?: () => void };

function MenuItem({ icon, label, danger, onPress }: MenuItemProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.65} onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 18 }}>
      {icon}
      <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: danger ? colors.destructive : colors.textPrimary, marginLeft: 14 }}>{label}</Text>
      {!danger && <ChevronRight size={16} color={colors.textTertiary} />}
    </TouchableOpacity>
  );
}

function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.8, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 6, textTransform: "uppercase" }}>
      {label}
    </Text>
  );
}

export default function SettingsSidebar({ visible, onClose }: Props) {
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const [translateX] = useState(() => new Animated.Value(-SIDEBAR_WIDTH));
  const [backdrop] = useState(() => new Animated.Value(0));

  const { profile } = useAuth();
  
  // Safe fallback if profile is missing
  const currentUser = profile || {
    full_name: "Mark Antipo",
    username: "mark_antipo",
    avatar_url: null,
    department_name: null,
    year_level: "3rd Year"
  };

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdrop, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateX, { toValue: -SIDEBAR_WIDTH, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  const go = (path: string) => {
    onClose();
    router.push(path as any);
  };

  return (
    <View pointerEvents={visible ? "box-none" : "none"}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>

      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.35)", opacity: backdrop }} />
      </TouchableWithoutFeedback>

      <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: SIDEBAR_WIDTH, backgroundColor: colors.surface, transform: [{ translateX }], shadowColor: "#000", shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 25 }}>

        {/* Blue header */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 20, backgroundColor: isDark ? "hsl(215, 35%, 15%)" : "#1A56DB", borderBottomWidth: isDark ? 1 : 0, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ alignSelf: "flex-end", marginBottom: 16 }}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.actionSurfaceAlt, alignItems: "center", justifyContent: "center", marginRight: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{getInitials(currentUser.full_name)}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 17, fontWeight: "700", color: "#FFFFFF" }}>{currentUser.full_name}</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{currentUser.department_name || "No department"} · {currentUser.year_level || "—"}</Text>
            </View>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          <SectionLabel label="Account" />
          <MenuItem icon={<UserCircle size={20} color={colors.action} />} label="Edit Profile" onPress={() => go("/edit-profile")} />
          <MenuItem icon={<Shield size={20} color={colors.action} />} label="Privacy" onPress={() => go("/settings")} />
          <MenuItem icon={<Lock size={20} color={colors.action} />} label="Security" />

          <SectionLabel label="Messages" />
          <MenuItem icon={<MessageSquare size={20} color={colors.action} />} label="Messages" onPress={() => go("/messages")} />
          <MenuItem icon={<Users size={20} color={colors.action} />} label="Friends & Requests" onPress={() => go("/friends")} />
          <MenuItem icon={<Shield size={20} color={colors.action} />} label="Messaging & Presence" onPress={() => go("/settings")} />

          <SectionLabel label="App" />
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
          <MenuItem icon={<Palette size={20} color={colors.action} />} label="Appearance" onPress={() => go("/settings")} />
          <MenuItem icon={<BellRing size={20} color={colors.action} />} label="Notifications" />

          <SectionLabel label="Institution" />
          <MenuItem icon={<School size={20} color={colors.action} />} label="About LCCB" />
          <MenuItem icon={<Flag size={20} color={colors.action} />} label="Report an Issue" />

          <View style={{ height: 1, backgroundColor: colors.border, marginTop: 24, marginHorizontal: 18 }} />
          <MenuItem icon={<LogOut size={20} color={colors.destructive} />} label="Sign Out" danger onPress={handleSignOut} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}