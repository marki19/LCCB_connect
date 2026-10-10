import { useState, useEffect } from "react";
import { View, Text, SectionList, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BookOpen, FileText, CheckCheck, Sparkles } from "lucide-react-native";
import { supabase } from "../../src/lib/supabase";

type ActivityNotif = {
  id: string;
  type: "thesis" | "post";
  user: {
    name: string;
    initials: string;
    avatarColor: string;
  };
  text: string;
  time: string;
  unread: boolean;
};

export default function NotificationsScreen() {
  const [sections, setSections] = useState<{ title: string; data: ActivityNotif[] }[]>([]);
  const [loading, setLoading] = useState(true);

  const getInitials = (name?: string | null) => {
    if (!name) return "LC";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    const fetchActivities = async () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
      const notifs: ActivityNotif[] = [];

      try {
        // 1. Fetch latest theses for notification feed
        const resTheses = await fetch(`${apiUrl}/theses`);
        if (resTheses.ok) {
          const theses = await resTheses.json();
          theses.slice(0, 5).forEach((t: any) => {
            const authorName = t.uploader?.full_name || t.author?.full_name || "Academic Author";
            notifs.push({
              id: `thesis-${t.id}`,
              type: "thesis",
              user: {
                name: authorName,
                initials: getInitials(authorName),
                avatarColor: "#EDE9FE",
              },
              text: `deposited manuscript: "${t.title}"`,
              time: new Date(t.created_at).toLocaleDateString(),
              unread: true,
            });
          });
        }

        // 2. Fetch latest posts for notification feed
        const resPosts = await fetch(`${apiUrl}/posts`);
        if (resPosts.ok) {
          const posts = await resPosts.json();
          posts.slice(0, 5).forEach((p: any) => {
            const authorName = p.author?.full_name || "Student Researcher";
            notifs.push({
              id: `post-${p.id}`,
              type: "post",
              user: {
                name: authorName,
                initials: getInitials(authorName),
                avatarColor: "#DBEAFE",
              },
              text: `shared an update: "${p.title || p.content?.slice(0, 40) || 'New project'}"`,
              time: new Date(p.created_at).toLocaleDateString(),
              unread: false,
            });
          });
        }
      } catch {
        // Fallback to Supabase if backend unreachable
        try {
          const { data: thesesData } = await supabase.from('theses').select('*, author:profiles(*)').limit(5);
          if (thesesData) {
            thesesData.forEach((t: any) => {
              const name = t.author?.full_name || "Academic Author";
              notifs.push({
                id: `thesis-${t.id}`,
                type: "thesis",
                user: { name, initials: getInitials(name), avatarColor: "#EDE9FE" },
                text: `deposited manuscript: "${t.title}"`,
                time: new Date(t.created_at).toLocaleDateString(),
                unread: true,
              });
            });
          }
        } catch {}
      }

      setSections([
        {
          title: "Recent Campus Activity",
          data: notifs,
        },
      ]);
      setLoading(false);
    };

    fetchActivities();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#1E293B" }}>Notifications</Text>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center" }}>
          <CheckCheck size={16} color="#1A56DB" />
          <Text style={{ color: "#1A56DB", fontWeight: "600", fontSize: 14, marginLeft: 4 }}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="small" color="#1A56DB" />
        </View>
      ) : (
        <SectionList
          sections={sections}
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
            const isThesis = item.type === "thesis";
            const Icon = isThesis ? BookOpen : FileText;
            const iconColor = isThesis ? "#6D28D9" : "#1A56DB";
            const iconBg = isThesis ? "#EDE9FE" : "#DBEAFE";

            return (
              <TouchableOpacity activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: item.unread ? "#EFF6FF" : "#FFFFFF" }}>
                <View style={{ position: "relative", marginRight: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: item.user.avatarColor, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#1E293B" }}>{item.user.initials}</Text>
                  </View>
                  <View style={{ position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: iconBg, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" }}>
                    <Icon size={12} color={iconColor} />
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
      )}
    </SafeAreaView>
  );
}