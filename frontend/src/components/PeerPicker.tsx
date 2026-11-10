import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  SectionList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Search, MessageSquare, UserPlus, Check, X, Lock, Users } from "lucide-react-native";
import { apiJson, apiFetch } from "../lib/api";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { usePresence } from "../contexts/PresenceContext";
import Avatar from "./Avatar";
import Modal from "./ui/Modal";
import Button, { IconButton } from "./ui/Button";
import EmptyState from "./admin/EmptyState";
import { focusRing, RADIUS, SPACE, TYPE } from "../lib/tokens";

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

type Action = {
  icon: any;
  text: string;
  variant: "primary" | "secondary" | "muted";
  disabled: boolean;
  label: string;
  onPress?: () => void;
};

export default function PeerPicker({ visible, onClose, onOpened, mode = "message" }: Props) {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const { modeOf } = usePresence();
  const router = useRouter();
  const [sections, setSections] = useState<{ title: string; data: Peer[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    onClose();
  };

  const openThread = async (peer: Peer, label: string) => {
    // Check profile completion before attempting to start a conversation
    // Banner dismissal does NOT bypass this - profile must be complete to post/message
    if (profile?.profile_completed === false) {
      Alert.alert(
        "Complete Your Profile",
        "You need to complete your profile (full name, student ID, department, and course) before you can post or message.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Complete Profile",
            onPress: () => {
              handleClose();
              router.push("/onboarding");
            }
          }
        ]
      );
      return;
    }

    setBusyId(peer.id);
    setError(null);
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
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async (peer: Peer) => {
    setBusyId(peer.id);
    setError(null);
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
      setError(err instanceof Error ? err.message : "Please try again.");
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
      primary = {
        icon: MessageSquare,
        text: "Message",
        variant: "primary",
        disabled: isBusy,
        label: `Message ${name}`,
        onPress: () => void openThread(item, "message"),
      };
    } else if (isMessageMode && isRequest) {
      primary = {
        icon: MessageSquare,
        text: "Request",
        variant: "secondary",
        disabled: isBusy,
        label: `Request to message ${name}`,
        onPress: () => void openThread(item, "request"),
      };
    } else if (isMessageMode && isBlocked) {
      primary = {
        icon: Lock,
        text: "Blocked",
        variant: "muted",
        disabled: true,
        label: `Cannot message ${name}`,
      };
    } else if (!isMessageMode && !isBlocked) {
      if (isPendingIn) {
        primary = {
          icon: Check,
          text: "Pending",
          variant: "muted",
          disabled: true,
          label: `Request pending from ${name}`,
        };
      } else {
        primary = {
          icon: UserPlus,
          text: "Add friend",
          variant: "primary",
          disabled: isBusy || isPendingOut,
          label: `Add ${name} as friend`,
          onPress: () => void handleAdd(item),
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
          gap: SPACE.x3,
          paddingHorizontal: SPACE.x4,
          paddingVertical: SPACE.x3,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <Avatar name={item.full_name || item.username} size={42} showPresence mode={modeOf(item.id)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink }}
          >
            {name}
          </Text>
          <Text
            numberOfLines={1}
            style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2 }}
          >
            {item.department_name || "No department"}
            {item.year_level ? ` · ${item.year_level}` : ""}
          </Text>
        </View>

        {isPendingOut ? (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colors.jadeWash,
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityLabel={`Friend request sent to ${name}`}
          >
            <Check size={15} color={colors.jadeText} />
          </View>
        ) : null}

        {primary ? (
          <Button
            label={primary.text}
            size="sm"
            variant={
              primary.variant === "primary"
                ? "primary"
                : primary.variant === "secondary"
                ? "secondary"
                : "subtle"
            }
            icon={primary.icon}
            onPress={primary.onPress}
            disabled={primary.disabled}
            accessibilityLabel={primary.label}
          />
        ) : null}

        {showSecondaryAdd ? (
          <IconButton
            icon={UserPlus}
            label={`Add ${name} as friend`}
            variant="subtle"
            size={34}
            onPress={() => void handleAdd(item)}
          />
        ) : null}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      maxWidth={540}
      accessibilityLabel={mode === "message" ? "New message" : "Add friend"}
      sheetOnMobile
    >
      <View style={{ flexShrink: 1, maxHeight: "100%", paddingBottom: SPACE.x3 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.x3,
            paddingHorizontal: SPACE.x4,
            paddingTop: SPACE.x4,
            paddingBottom: SPACE.x2,
          }}
        >
          <Text style={{ ...TYPE.h2, color: colors.ink }}>
            {mode === "message" ? "New message" : "Add friend"}
          </Text>
          <IconButton icon={X} label="Close" size={36} onPress={handleClose} />
        </View>

        <View style={{ paddingHorizontal: SPACE.x4, paddingBottom: SPACE.x2 }}>
          <View
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.x2,
                backgroundColor: colors.inputBg,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: searchFocused ? colors.brand : colors.inputBorder,
                paddingHorizontal: SPACE.x3,
              },
              focusRing(colors, searchFocused),
            ]}
          >
            <Search size={16} color={colors.inkFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, username, or department"
              placeholderTextColor={colors.inkFaint}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={
                {
                  flex: 1,
                  minHeight: 44,
                  fontSize: 14,
                  color: colors.ink,
                  outlineStyle: "none",
                } as any
              }
              accessibilityLabel="Search peers by name, username, or department"
            />
          </View>
        </View>

        {error ? (
          <View
            style={{
              marginHorizontal: SPACE.x4,
              marginBottom: SPACE.x2,
              padding: SPACE.x3,
              borderRadius: RADIUS.md,
              backgroundColor: colors.coralWash,
              borderWidth: 1,
              borderColor: colors.coral,
            }}
            accessibilityLiveRegion="polite"
          >
            <Text style={{ ...TYPE.caption, color: colors.coralText, fontWeight: "600" }}>
              {error}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: SPACE.x10, alignItems: "center" }}>
            <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.brand} />
          </View>
        ) : (
          <SectionList
            style={{ flexShrink: 1 }}
            sections={sections}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderSectionHeader={({ section: { title } }) => (
              <View
                style={{
                  paddingHorizontal: SPACE.x4,
                  paddingTop: SPACE.x3,
                  paddingBottom: SPACE.x1,
                  backgroundColor: colors.surfaceElevated,
                }}
              >
                <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>{title}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={{ paddingVertical: SPACE.x8, paddingHorizontal: SPACE.x6 }}>
                <EmptyState
                  icon={query ? Search : Users}
                  tone="neutral"
                  compact
                  title={query ? "No people found" : "No one to show yet"}
                  body={
                    query
                      ? "Try a different name, username, or department."
                      : "People in your network will appear here."
                  }
                />
              </View>
            }
            renderItem={renderItem}
          />
        )}
      </View>
    </Modal>
  );
}
