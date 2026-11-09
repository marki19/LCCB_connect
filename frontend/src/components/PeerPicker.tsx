import React, { useEffect, useState } from "react";
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
import { Search, MessageSquare, UserPlus, Check, X, Lock } from "lucide-react-native";
import { apiJson, apiFetch } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { usePresence } from "../contexts/PresenceContext";
import Avatar from "./Avatar";

/**
 * Peer directory with Message / Request / Add-friend actions.
 * Uses GET /api/users/directory for friendship state, department grouping, and message_decision.
 * SectionList sections: Friends, Same department, Others.
 *
 * Modes:
 * - "message": primary = message/request via POST /conversations; secondary = add friend via POST /friends
 * - "friend": primary = add friend via POST /friends
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

type Mode = "message" | "friend";

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpened?: (conversationId: string) => void;
  mode?: Mode;
};

type Variant = "filled" | "outlined" | "muted";

type Action = {
  icon: any;
  text: string;
  variant: Variant;
  disabled: boolean;
  label: string;
  onPress?: () => void;
};

export default function PeerPicker({ visible, onClose, onOpened, mode = "message" }: Props) {
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

  const openThread = async (peer: Peer, label: string) => {
    setBusyId(peer.id);
    try {
      const res = await apiFetch("/conversations", {
        method: "POST",
        body: JSON.stringify({ peer_id: peer.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Could not ${label.toLowerCase()}`);
      }
      const conversation = await res.json();
      handleClose();
      onOpened?.(conversation.id);
    } catch (err) {
      Alert.alert(`Can't ${label.toLowerCase()}`, err instanceof Error ? err.message : "Please try again.");
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
    // Blocked pairs are excluded by the directory query; trust message_decision.
    const isBlocked = item.message_decision === "blocked";
    const isFriend = item.friendship === "friend";
    const isPendingOut = item.friendship === "pending_out";
    const isPendingIn = item.friendship === "pending_in";
    const isNone = item.friendship === "none";
    const isRequest = item.message_decision === "request" && !isFriend;
    const isMessageMode = mode === "message";
    const name = item.full_name || item.username || "Peer";

    // Compute primary action (never null unless blocked with no fallback)
    let primary: Action | null = null;

    if (isFriend || (isMessageMode && item.message_decision === "direct" && !isBlocked)) {
      // Message existing friend, or message-mode + direct policy
      primary = {
        icon: MessageSquare,
        text: "Message",
        variant: "filled",
        disabled: isBusy,
        label: `Message ${name}`,
        onPress: () => openThread(item, "message"),
      };
    } else if (isMessageMode && isRequest) {
      // Message mode + request decision → message request
      primary = {
        icon: MessageSquare,
        text: "Request",
        variant: "outlined",
        disabled: isBusy,
        label: `Request to message ${name}`,
        onPress: () => openThread(item, "request"),
      };
    } else if (isMessageMode && isBlocked) {
      // Blocked in message mode
      primary = {
        icon: Lock,
        text: "Blocked",
        variant: "muted",
        disabled: true,
        label: `Cannot message ${name}`,
      };
    } else if (!isMessageMode && !isBlocked) {
      // Friend mode: only add friend (never message non-friends)
      if (isPendingIn) {
        primary = {
          icon: Check,
          text: "Pending request",
          variant: "muted",
          disabled: true,
          label: `Request pending from ${name}`,
        };
      } else {
        primary = {
          icon: UserPlus,
          text: "Add friend",
          variant: "filled",
          disabled: isBusy || isPendingOut,
          label: `Add ${name} as friend`,
          onPress: () => handleAdd(item),
        };
      }
    }

    // Secondary add-friend icon: message mode, non-friend, no block, friendship === "none" only
    const showSecondaryAdd = isMessageMode && !isFriend && !isBlocked && isNone;

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
            {name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
            {item.department_name || "No department"}
            {item.year_level ? ` · ${item.year_level}` : ""}
          </Text>
        </View>

        {/* Slot 1: pending_out check icon */}
        {isPendingOut && (
          <TouchableOpacity
            disabled
            accessibilityRole="button"
            accessibilityLabel={`Add ${name} as friend`}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isDark ? "hsl(150, 30%, 15%)" : "#DCFCE7",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Check size={16} color="#16A34A" />
          </TouchableOpacity>
        )}

        {/* Slot 2: primary action button */}
        {primary && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={primary.label}
            disabled={primary.disabled}
            onPress={primary.onPress}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 18,
              opacity: primary.disabled ? 0.6 : 1,
              backgroundColor:
                primary.variant === "filled"
                  ? colors.action
                  : primary.variant === "outlined"
                  ? "transparent"
                  : colors.surfaceSunken,
              borderWidth: primary.variant === "outlined" ? 2 : primary.variant === "muted" ? 1 : 0,
              borderColor:
                primary.variant === "outlined"
                  ? colors.action
                  : primary.variant === "muted"
                  ? colors.border
                  : undefined,
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {React.createElement(primary.icon, {
              size: 14,
              color: primary.disabled
                ? colors.textTertiary
                : primary.variant === "outlined"
                ? colors.action
                : "#FFFFFF",
            })}
            <Text
              style={{
                color: primary.disabled
                  ? colors.textTertiary
                  : primary.variant === "outlined"
                  ? colors.action
                  : "#FFFFFF",
                fontSize: 13,
                fontWeight: "700",
                marginLeft: 6,
              }}
            >
              {primary.text}
            </Text>
          </TouchableOpacity>
        )}

        {/* Slot 3: secondary add-friend icon (message mode, none only) */}
        {showSecondaryAdd && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Add ${name} as friend`}
            disabled={isBusy}
            onPress={() => handleAdd(item)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.actionSurface,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <UserPlus size={18} color={colors.action} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end", alignItems: "center" }}>
        <View
          style={{
            width: "100%",
            maxWidth: 520,
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
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>
              {mode === "message" ? "New message" : "Add friend"}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              style={{ padding: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Close peer picker"
            >
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
              accessibilityLabel="Search peers by name, username, or department"
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
