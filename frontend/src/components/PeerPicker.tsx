import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Search, MessageSquare, UserPlus, Check, X } from "lucide-react-native";
import { apiFetch } from "../lib/api";
import { openConversation, sendFriendRequest } from "../lib/messages";
import { useAuth } from "../contexts/AuthContext";
import Avatar from "./Avatar";

/**
 * Peer directory with Message / Add-friend actions (Messaging_plan.md §4, §12).
 * The button reads "Message" or "Request" based on the server's permission
 * decision (POST /conversations returns the created thread either way).
 */

type Peer = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  department_name: string | null;
  year_level: string | null;
  role: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpened?: (conversationId: string) => void;
};

export default function PeerPicker({ visible, onClose, onOpened }: Props) {
  const { profile } = useAuth();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [requested, setRequested] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch("/users");
        const data: Peer[] = res.ok ? await res.json() : [];
        if (cancelled) return;
        setPeers(Array.isArray(data) ? data.filter((p) => p.id !== profile?.id) : []);
      } catch {
        // Leave the list empty; the user can reopen.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, profile?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter((p) =>
      [p.full_name, p.username, p.department_name].some((v) => v?.toLowerCase().includes(q))
    );
  }, [peers, query]);

  const handleMessage = async (peer: Peer) => {
    setBusyId(peer.id);
    try {
      const conversation = await openConversation(peer.id);
      onClose();
      onOpened?.(conversation.id);
    } catch (err) {
      Alert.alert("Can't message", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async (peer: Peer) => {
    setBusyId(peer.id);
    try {
      await sendFriendRequest(peer.id);
      setRequested((prev) => ({ ...prev, [peer.id]: true }));
    } catch (err) {
      Alert.alert("Can't send request", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.35)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "85%",
            paddingBottom: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#0F172A" }}>New message</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#F1F5F9",
              borderRadius: 12,
              marginHorizontal: 16,
              marginBottom: 8,
              paddingHorizontal: 12,
            }}
          >
            <Search size={16} color="#94A3B8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search people"
              placeholderTextColor="#94A3B8"
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: "#0F172A" }}
            />
          </View>

          {loading ? (
            <View style={{ paddingVertical: 48, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#1A56DB" />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={{ paddingVertical: 48, alignItems: "center" }}>
                  <Text style={{ color: "#94A3B8", fontSize: 14 }}>No people found</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isBusy = busyId === item.id;
                const alreadyRequested = requested[item.id];
                return (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: "#F1F5F9",
                    }}
                  >
                    <Avatar name={item.full_name || item.username} size={44} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: "#0F172A" }}>
                        {item.full_name || item.username || "Peer"}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                        {item.department_name || "No department"}
                        {item.year_level ? ` · ${item.year_level}` : ""}
                      </Text>
                    </View>

                    <TouchableOpacity
                      disabled={isBusy}
                      onPress={() => handleAdd(item)}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        backgroundColor: alreadyRequested ? "#DCFCE7" : "#F1F5F9",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 8,
                      }}
                    >
                      {alreadyRequested ? (
                        <Check size={16} color="#16A34A" />
                      ) : (
                        <UserPlus size={16} color="#1A56DB" />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      disabled={isBusy}
                      onPress={() => handleMessage(item)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#1A56DB",
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 18,
                        opacity: isBusy ? 0.6 : 1,
                      }}
                    >
                      <MessageSquare size={14} color="#FFFFFF" />
                      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700", marginLeft: 6 }}>
                        Message
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
