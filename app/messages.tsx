import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessageSquarePlus } from "lucide-react-native";
import { PROTOTYPE_USERS } from "../src/data/prototype";
import rawConversations from "../src/data/mock/conversations.json";

type Conversation = {
  id: string;
  userId: string;
  lastMessage: string;
  time: string;
  unread: boolean;
};

const CONVERSATIONS = (rawConversations as Conversation[]).flatMap((conv) => {
  const user = PROTOTYPE_USERS.find((u) => u.id === conv.userId);
  if (!user) return [];
  return [{ ...conv, user }];
});

export default function MessagesScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#1E293B" }}>Messages</Text>
        <TouchableOpacity style={{ width: 40, height: 40, backgroundColor: "#EFF6FF", borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
          <MessageSquarePlus size={20} color="#1A56DB" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={CONVERSATIONS}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
            <Text style={{ fontSize: 16, color: "#94A3B8", fontWeight: "500" }}>No messages yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: item.unread ? "#F8FAFC" : "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" }}
          >
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: item.user.avatarColor, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#1E293B" }}>{item.user.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: item.unread ? "700" : "600", color: "#1E293B" }}>{item.user.name}</Text>
                <Text style={{ fontSize: 12, color: item.unread ? "#1A56DB" : "#94A3B8", fontWeight: item.unread ? "600" : "400" }}>{item.time}</Text>
              </View>
              <Text numberOfLines={1} style={{ fontSize: 14, color: item.unread ? "#334155" : "#94A3B8", fontWeight: item.unread ? "500" : "400" }}>
                {item.lastMessage}
              </Text>
            </View>
            {item.unread && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#1A56DB", marginLeft: 12 }} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}