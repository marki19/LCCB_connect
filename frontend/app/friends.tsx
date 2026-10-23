import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, UserPlus, MessageSquare, Check, X, UserMinus } from "lucide-react-native";
import Avatar from "../src/components/Avatar";
import PeerPicker from "../src/components/PeerPicker";
import { usePresence } from "../src/contexts/PresenceContext";
import { useTheme } from "../src/contexts/ThemeContext";
import {
  acceptFriendRequest,
  declineFriendRequest,
  listFriendRequests,
  listFriends,
  openConversation,
  removeFriend,
} from "../src/lib/messages";
import type { ConversationPeer, Friend, FriendRequests } from "../src/types";
import { safeBack } from "../src/lib/navigation";

/**
 * Friends (Messaging_plan.md §5): mutual request → accept. Accepted friends
 * bypass the recipient's "who can message me" policy.
 */

export default function FriendsScreen() {
  const router = useRouter();
  const { modeOf } = usePresence();
  const { colors, isDark } = useTheme();

  const [tab, setTab] = useState<"friends" | "requests">("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [friendList, requestList] = await Promise.all([listFriends(), listFriendRequests()]);
      setFriends(friendList);
      setRequests(requestList);
    } catch {
      // Best-effort; pull-to-refresh retries.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [friendList, requestList] = await Promise.all([listFriends(), listFriendRequests()]);
        if (cancelled) return;
        setFriends(friendList);
        setRequests(requestList);
      } catch {
        // Best-effort; pull-to-refresh retries.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const startChat = async (peer: ConversationPeer) => {
    try {
      const conversation = await openConversation(peer.id);
      router.push(`/messages/${conversation.id}`);
    } catch (err) {
      Alert.alert("Can't message", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const handleRemove = (friend: Friend) => {
    Alert.alert(
      "Remove friend",
      `Remove ${friend.peer.full_name || friend.peer.username} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeFriend(friend.peer.id);
              await load();
            } catch {
              // Non-fatal.
            }
          },
        },
      ]
    );
  };

  const respond = async (id: string, action: "accept" | "decline") => {
    try {
      if (action === "accept") await acceptFriendRequest(id);
      else await declineFriendRequest(id);
      await load();
    } catch {
      // Non-fatal.
    }
  };

  const requestCount = requests.incoming.length;
  const data: Friend[] = friends;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingVertical: 12,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => safeBack("/(tabs)")} style={{ padding: 6, marginRight: 4 }}>
            <ArrowLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.textPrimary }}>Friends</Text>
        </View>
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          style={{ width: 40, height: 40, backgroundColor: colors.actionSurface, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
        >
          <UserPlus size={20} color={colors.action} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        {(["friends", "requests"] as const).map((key) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: active ? colors.action : colors.surfaceSunken }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: active ? "#FFFFFF" : colors.textSecondary }}>
                {key === "friends" ? `Friends (${friends.length})` : "Requests"}
              </Text>
              {key === "requests" && requestCount > 0 && (
                <View style={{ marginLeft: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: active ? "#FFFFFF" : colors.destructive, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: active ? colors.action : "#FFFFFF" }}>{requestCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="small" color={colors.action} />
        </View>
      ) : tab === "friends" ? (
        <FlatList
          style={{ flex: 1, marginTop: 12 }}
          data={data}
          keyExtractor={(item) => item.peer.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.action} />}
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Avatar name={item.peer.full_name || item.peer.username} size={48} showPresence mode={modeOf(item.peer.id)} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
                  {item.peer.full_name || item.peer.username || "Friend"}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                  {item.peer.department_name || "No department"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => void startChat(item.peer)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.actionSurface, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                <MessageSquare size={17} color={colors.action} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleRemove(item)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? "hsl(0, 30%, 15%)" : "#FEF2F2", alignItems: "center", justifyContent: "center" }}>
                <UserMinus size={17} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 72, paddingHorizontal: 32 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.actionSurface, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <UserPlus size={24} color={colors.action} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 }}>No friends yet</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: "center", lineHeight: 18 }}>
                Add people to message them regardless of their messaging policy.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          style={{ flex: 1, marginTop: 12 }}
          data={requests.incoming}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.action} />}
          ListHeaderComponent={
            requests.incoming.length > 0 ? (
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.6, paddingHorizontal: 16, paddingBottom: 4, textTransform: "uppercase" }}>
                Incoming
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Avatar name={item.requester.full_name || item.requester.username} size={48} showPresence mode={modeOf(item.requester.id)} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
                  {item.requester.full_name || item.requester.username || "Someone"}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>wants to be friends</Text>
              </View>
              <TouchableOpacity onPress={() => void respond(item.id, "decline")} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSunken, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                <X size={17} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void respond(item.id, "accept")} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.action, alignItems: "center", justifyContent: "center" }}>
                <Check size={17} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={
            requests.outgoing.length > 0 ? (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, textTransform: "uppercase" }}>
                  Sent
                </Text>
                {requests.outgoing.map((item) => (
                  <View key={item.id} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Avatar name={item.addressee.full_name || item.addressee.username} size={44} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
                        {item.addressee.full_name || item.addressee.username || "Someone"}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Pending</Text>
                    </View>
                    <TouchableOpacity onPress={() => void respond(item.id, "decline")} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.surfaceSunken }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            requests.outgoing.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 72, paddingHorizontal: 32 }}>
                <Text style={{ fontSize: 15, color: colors.textTertiary, fontWeight: "500" }}>No friend requests</Text>
              </View>
            ) : undefined
          }
        />
      )}

      <PeerPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onOpened={(id) => router.push(`/messages/${id}`)} />
    </SafeAreaView>
  );
}
