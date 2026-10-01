import { View, Text, SectionList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heart, MessageCircle, UserPlus, CheckCheck } from "lucide-react-native";
import { PROTOTYPE_USERS } from "../src/data/prototype";
import rawNotifications from "../src/data/mock/notifications.json";

type RawNotif = { id: string; type: string; userId: string; text: string; time: string; unread: boolean; section: string };

type NotifItem = Omit<RawNotif, "userId"> & { user: (typeof PROTOTYPE_USERS)[0] };

// Resolve userId → user object, then group by section
const resolved: NotifItem[] = (rawNotifications as RawNotif[]).flatMap((n) => {
  const user = PROTOTYPE_USERS.find((u) => u.id === n.userId);
  if (!user) return [];
  return [{ ...n, user }];
});

const sectionTitles = Array.from(new Set(resolved.map((n) => n.section)));
const SECTIONS = sectionTitles.map((title) => ({
  title,
  data: resolved.filter((n) => n.section === title),
}));

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#1E293B" }}>Notifications</Text>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center" }}>
          <CheckCheck size={16} color="#1A56DB" />
          <Text style={{ color: "#1A56DB", fontWeight: "600", fontSize: 14, marginLeft: 4 }}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={SECTIONS}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <Text style={{ fontSize: 16, color: "#94A3B8", fontWeight: "500" }}>No notifications yet</Text>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#94A3B8", paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, backgroundColor: "#FFFFFF" }}>
            {title.toUpperCase()}
          </Text>
        )}
        renderItem={({ item }) => {
          let Icon = Heart;
          let iconColor = "#EF4444";
          let iconBg = "#FEE2E2";
          if (item.type === "comment") { Icon = MessageCircle; iconColor = "#1A56DB"; iconBg = "#DBEAFE"; }
          if (item.type === "follow")  { Icon = UserPlus;      iconColor = "#059669"; iconBg = "#D1FAE5"; }

          return (
            <TouchableOpacity activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: item.unread ? "#EFF6FF" : "#FFFFFF" }}>
              <View style={{ position: "relative", marginRight: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: item.user.avatarColor, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B" }}>{item.user.initials}</Text>
                </View>
                <View style={{ position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: iconBg, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" }}>
                  <Icon size={12} color={iconColor} fill={item.type === "like" ? iconColor : "none"} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: "#334155", lineHeight: 20 }}>
                  <Text style={{ fontWeight: "700", color: "#1E293B" }}>{item.user.name}</Text>{" "}{item.text}
                </Text>
                <Text style={{ fontSize: 12, color: item.unread ? "#1A56DB" : "#94A3B8", marginTop: 4, fontWeight: "500" }}>{item.time}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}