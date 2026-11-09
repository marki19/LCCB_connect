import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import React from "react";
import { Search, MessageSquare, UserPlus, Check, X, Lock } from "lucide-react-native";
import { apiJson, apiFetch } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { usePresence } from "../contexts/PresenceContext";
import Avatar from "./Avatar";

/**
 * Peer directory with Message / Add-friend actions (Messaging_plan.md §4, §12).
 * Uses GET /api/users/directory for friendship state, department grouping, and message_decision.
 * SectionList sections: Friends, Same department, Others.
 * Button by decision: direct → filled "Message"; request → outlined "Request" + UserPlus; blocked → muted Lock, disabled.
 */

type Peer = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  year_level: string | null;
  department_id: string | null;
  department_name: string | null;
  friendship: "friend" | "pending_out" | "pending_in" | "none";
  message_decision: "direct" | "request" | "blocked";
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpened?: (conversationId: string) => void;
};

export default function PeerPicker({ visible, onClose, onOpened }: Props) {
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const { modeOf } = usePresence();
  const [sections, setSections] = useState<{ title: string; data: Peer[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query, visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = ["limit=50"];
        if (debouncedQuery) params.push(`q=${encodeURIComponent(debouncedQuery)}`);
        params.push("scope=network");
        const data: Peer[] = await apiJson<Peer[]>(`/users/directory?${params.join("&")}`);
        if (cancelled) return;

        // Group into sections
        const friends = data.filter((p) => p.friendship === "friend");
        const myDept = profile?.department_id;
        const sameDept = data.filter(
          (p) => p.friendship !== "friend" && myDept && p.department_id === myDept
        );
        const others = data.filter(
          (p) => p.friendship !== "friend" && (!myDept || p.department_id !== myDept)
        );

        const newSections = [];
        if (friends.length > 0) newSections.push({ title: "Friends", data: friends });
        if (sameDept.length > 0) newSections.push({ title: "Same department", data: sameDept });
        if (others.length > 0) newSections.push({ title: "Others", data: others });
        if (newSections.length === 0) newSections.push({ title: "All", data: data });

        setSections(newSections);
      } catch {
        // Leave the list empty; the user can reopen.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, profile?.id, profile?.department_id, debouncedQuery]);

  const handleClose = () => {
    setQuery("");
    setDebouncedQuery("");
    setSections([]);
    onClose();
  };

  const handleMessage = async (peer: Peer) => {
    setBusyId(peer.id);
    try {
      const res = await apiFetch("/conversations", {
        method: "POST",
        body: JSON.stringify({ peer_id: peer.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Could not open conversation");
      }
      const conversation = await res.json();
      handleClose();
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
      const res = await apiFetch("/friends", {
        method: "POST",
        body: JSON.stringify({ addressee_id: peer.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Could not send request");
      }
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          data: section.data.map((p) =>
            p.id === peer.id ? { ...p, friendship: "pending_out" as const } : p
          ),
        }))
      );
    } catch (err) {
      Alert.alert("Can't send request", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: Peer }) => {
    const isBusy = busyId === item.id;
    const isBlocked = item.message_decision === "blocked" || item.friendship === "none";
    const isFriend = item.friendship === "friend";
    const isPendingOut = item.friendship === "pending_out";
    const isRequest = item.message_decision === "request" && !isFriend;

    // Button variant based on decision
    let buttonStyle: any = {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      opacity: isBusy ? 0.6 : 1,
    };
    let buttonIcon: any = MessageSquare;
    let buttonText = "Message";
    let buttonDisabled = isBusy || isBlocked;
    let accessibilityLabel = `Message ${item.full_name || item.username}`;

    if (isFriend || (item.message_decision === "direct" && !isBlocked)) {
      // Direct message - filled brand button
      buttonStyle = { ...buttonStyle, backgroundColor: colors.action };
      buttonIcon = MessageSquare;
      buttonText = "Message";
      accessibilityLabel = `Message ${item.full_name || item.username}`;
    } else if (isRequest) {
      // Request - outlined button with UserPlus
      buttonStyle = {
        ...buttonStyle,
        backgroundColor: "transparent",
        borderWidth: 2,
        borderColor: colors.action,
      };
      buttonIcon = UserPlus;
      buttonText = "Request";
      buttonDisabled = isBusy;
      accessibilityLabel = `Request to message ${item.full_name || item.username}`;
    } else {
      // Blocked - muted lock, disabled
      buttonStyle = {
        ...buttonStyle,
        backgroundColor: colors.surfaceSunken,
        borderWidth: 1,
        borderColor: colors.border,
      };
      buttonIcon = Lock;
      buttonText = "Blocked";
      buttonDisabled = true;
      accessibilityLabel = `Cannot message ${item.full_name || item.username}`;
    }

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Avatar name={item.full_name || item.username} size={44} showPresence mode={modeOf(item.id)} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
            {item.full_name || item.username || "Peer"}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
            {item.department_name || "No department"}
            {item.year_level ? ` · ${item.year_level}` : ""}
          </Text>
        </View>

        {isPendingOut ? (
          <TouchableOpacity
            disabled
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: isDark ? "hsl(150, 30%, 15%)" : "#DCFCE7",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            <Check size={16} color="#16A34A" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            disabled={buttonDisabled}
            onPress={isFriend || (item.message_decision === "direct" && !isBlocked) ? () => handleMessage(item) : () => handleAdd(item)}
            style={buttonStyle}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {React.createElement(buttonIcon, {
              size: 14,
              color: buttonDisabled ? colors.textTertiary : isRequest ? colors.action : "#FFFFFF",
            })}
            <Text
              style={{
                color: buttonDisabled ? colors.textTertiary : isRequest ? colors.action : "#FFFFFF",
                fontSize: 13,
                fontWeight: "700",
                marginLeft: 6,
              }}
            >
              {buttonText}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surface,
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
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>New message</Text>
            <TouchableOpacity onPress={handleClose} style={{ padding: 6 }}>
              <X size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surfaceSunken,
              borderRadius: 12,
              marginHorizontal: 16,
              marginBottom: 8,
              paddingHorizontal: 12,
            }}
          >
            <Search size={16} color={colors.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, username, or department"
              placeholderTextColor={colors.textTertiary}
              style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: colors.textPrimary }}
            />
          </View>

          {loading ? (
            <View style={{ paddingVertical: 48, alignItems: "center" }}>
              <ActivityIndicator size="small" color={colors.action} />
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderSectionHeader={({ section: { title } }) => (
                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase" }}>
                    {title}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ paddingVertical: 48, alignItems: "center" }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No people found</Text>
                </View>
              }
              renderItem={renderItem}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
