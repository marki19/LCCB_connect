import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessageSquarePlus } from "lucide-react-native";
import { supabase } from "../src/lib/supabase";
import type { User } from "../src/types";

export default function MessagesScreen() {
  const [peers, setPeers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const getInitials = (name?: string | null) => {
    if (!name) return "LC";
    return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    const fetchPeers = async () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
      try {
        const res = await fetch(`${apiUrl}/users`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setPeers(data.map((u: any) => ({
              id: u.id,
              name: u.full_name || u.username || "Peer",
              initials: getInitials(u.full_name || u.username),
              avatarColor: "#DBEAFE",
              course: u.course || "BSIT",
              yearLevel: u.year_level || "3rd Year",
            })));
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback
      }

      // Supabase fallback
      try {
        const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
        if (data && data.length > 0) {
          setPeers(data.map((u: any) => ({
            id: u.id,
            name: u.full_name || u.username || "Peer",
            initials: getInitials(u.full_name || u.username),
            avatarColor: "#DBEAFE",
            course: u.course || "BSIT",
            yearLevel: u.year_level || "3rd Year",
          })));
        }
      } catch (err) {
        console.error("Failed to load users:", err);
      }
      setLoading(false);
    };

    fetchPeers();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#1E293B" }}>Messages</Text>
        <TouchableOpacity style={{ width: 40, height: 40, backgroundColor: "#EFF6FF", borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
          <MessageSquarePlus size={20} color="#1A56DB" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="small" color="#1A56DB" />
        </View>
      ) : (
        <FlatList
          data={peers}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
              <Text style={{ fontSize: 16, color: "#94A3B8", fontWeight: "500" }}>No peers found in database</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: index === 0 ? "#F8FAFC" : "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}
            >
              <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: item.avatarColor, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#1E293B" }}>{item.initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: index === 0 ? "700" : "600", color: "#1E293B" }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: "#64748B" }}>{item.course} • {item.yearLevel}</Text>
                </View>
                <Text numberOfLines={1} style={{ fontSize: 14, color: "#64748B" }}>
                  Connect with {item.name} for research collaboration
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}