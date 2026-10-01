import { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Dimensions, ScrollView, TouchableWithoutFeedback } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, UserCircle, Shield, Lock, Palette, BellRing, School, Flag, LogOut, ChevronRight } from "lucide-react-native";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;

type Props   = { visible: boolean; onClose: () => void };
type MenuItemProps = { icon: React.ReactNode; label: string; danger?: boolean; onPress?: () => void };

function MenuItem({ icon, label, danger, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity activeOpacity={0.65} onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 13, paddingHorizontal: 18 }}>
      {icon}
      <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: danger ? "#EF4444" : "#1E293B", marginLeft: 14 }}>{label}</Text>
      {!danger && <ChevronRight size={16} color="#CBD5E1" />}
    </TouchableOpacity>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.8, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 6, textTransform: "uppercase" }}>
      {label}
    </Text>
  );
}

export default function SettingsSidebar({ visible, onClose }: Props) {
  const insets     = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const backdrop   = useRef(new Animated.Value(0)).current;

  const { profile } = useAuth();
  
  // Safe fallback if profile is missing
  const currentUser = profile || {
    full_name: "Guest User",
    username: "guest",
    avatar_url: null,
    course: "—",
    year_level: "—"
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

  return (
    <View pointerEvents={visible ? "box-none" : "none"}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>

      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.35)", opacity: backdrop }} />
      </TouchableWithoutFeedback>

      <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: SIDEBAR_WIDTH, backgroundColor: "#FFFFFF", transform: [{ translateX }], shadowColor: "#000", shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 25 }}>

        {/* Blue header */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: 20, backgroundColor: "#1A56DB" }}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ alignSelf: "flex-end", marginBottom: 16 }}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#BFDBFE", alignItems: "center", justifyContent: "center", marginRight: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1E293B" }}>{getInitials(currentUser.full_name)}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 17, fontWeight: "700", color: "#FFFFFF" }}>{currentUser.full_name}</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{currentUser.course} · {currentUser.year_level}</Text>
            </View>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          <SectionLabel label="Account" />
          <MenuItem icon={<UserCircle size={20} color="#1A56DB" />} label="Edit Profile" />
          <MenuItem icon={<Shield size={20} color="#1A56DB" />} label="Privacy" />
          <MenuItem icon={<Lock size={20} color="#1A56DB" />} label="Security" />

          <SectionLabel label="App" />
          <MenuItem icon={<Palette size={20} color="#1A56DB" />} label="Appearance" />
          <MenuItem icon={<BellRing size={20} color="#1A56DB" />} label="Notifications" />

          <SectionLabel label="Institution" />
          <MenuItem icon={<School size={20} color="#1A56DB" />} label="About LCCB" />
          <MenuItem icon={<Flag size={20} color="#1A56DB" />} label="Report an Issue" />

          <View style={{ height: 1, backgroundColor: "#F1F5F9", marginTop: 24, marginHorizontal: 18 }} />
          <MenuItem icon={<LogOut size={20} color="#EF4444" />} label="Sign Out" danger onPress={handleSignOut} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}