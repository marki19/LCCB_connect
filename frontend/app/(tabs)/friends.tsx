import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  MessageSquare,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";
import Button from "../../src/components/ui/Button";
import SectionHeader from "../../src/components/ui/SectionHeader";
import EmptyState from "../../src/components/admin/EmptyState";
import StatusBadge from "../../src/components/admin/StatusBadge";
import FriendPersonCard from "../../src/components/friends/FriendPersonCard";
import FriendPersonRow from "../../src/components/friends/FriendPersonRow";
import FriendsTabs, { type FriendsTab } from "../../src/components/friends/FriendsTabs";
import { usePresence } from "../../src/contexts/PresenceContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useToast } from "../../src/contexts/ToastContext";
import { useFloatingChat } from "../../src/contexts/FloatingChatContext";
import { resolveFileUrl } from "../../src/lib/files";
import { safeBack } from "../../src/lib/navigation";
import { focusRing, SPACE, TYPE } from "../../src/lib/tokens";
import {
  acceptFriendRequest,
  declineFriendRequest,
  listFriendRequests,
  listFriends,
  listFriendSuggestions,
  openConversation,
  removeFriend,
  sendFriendRequest,
} from "../../src/lib/messages";
import type { ConversationPeer, Friend, FriendRequests, FriendSuggestion } from "../../src/types";

/**
 * Friends lives inside the tabs shell so the campus rail, top bar and contacts
 * rail stay put — the same behaviour as Notifications. Sections switch with
 * in-page pills rather than a second sidebar.
 */
export default function FriendsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 768;

  const { modeOf } = usePresence();
  const { colors } = useTheme();
  const { openChat } = useFloatingChat();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<FriendsTab>("requests");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] });
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [sentSuggestionIds, setSentSuggestionIds] = useState<Set<string>>(new Set());
  const [removedSuggestionIds, setRemovedSuggestionIds] = useState<Set<string>>(new Set());
  const [suggestionBusyId, setSuggestionBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [friendList, requestList, suggestionList] = await Promise.all([
        listFriends(100).catch(() => []),
        listFriendRequests(50).catch(() => ({ incoming: [], outgoing: [] })),
        listFriendSuggestions(24).catch(() => []),
      ]);
      setFriends(friendList);
      setRequests(requestList);
      setSuggestions(Array.isArray(suggestionList) ? suggestionList : []);
    } catch {
      // Best-effort
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [friendList, requestList, suggestionList] = await Promise.all([
          listFriends(100).catch(() => []),
          listFriendRequests(50).catch(() => ({ incoming: [], outgoing: [] })),
          listFriendSuggestions(24).catch(() => []),
        ]);
        if (cancelled) return;
        setFriends(friendList);
        setRequests(requestList);
        setSuggestions(Array.isArray(suggestionList) ? suggestionList : []);
      } catch {
        // Best-effort
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
      if (isDesktop) {
        openChat({
          peerId: peer.id,
          peerName: peer.full_name || peer.username || undefined,
          avatarUrl: resolveFileUrl(peer.avatar_url) || undefined,
        });
      } else {
        const conversation = await openConversation(peer.id);
        router.push(`/messages/${conversation.id}`);
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const handleRemove = (friend: Friend) => {
    const name = friend.peer.full_name || friend.peer.username;
    Alert.alert("Remove Friend", `Remove ${name} from your friends?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeFriend(friend.peer.id);
            setFriends((prev) => prev.filter((f) => f.peer.id !== friend.peer.id));
            showToast({ message: "Friend removed.", tone: "info" });
          } catch {
            // Non-fatal
          }
        },
      },
    ]);
  };

  const respond = async (id: string, action: "accept" | "decline") => {
    try {
      setProcessingId(id);
      if (action === "accept") {
        await acceptFriendRequest(id);
        showToast({ message: "Friend request accepted.", tone: "success" });
      } else {
        await declineFriendRequest(id);
        showToast({ message: "Friend request declined.", tone: "info" });
      }
      await load();
    } catch {
      // Non-fatal
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddSuggestion = async (suggestionId: string) => {
    setSuggestionBusyId(suggestionId);
    try {
      await sendFriendRequest(suggestionId);
      setSentSuggestionIds((prev) => new Set(prev).add(suggestionId));
      showToast({ message: "Friend request sent.", tone: "success" });
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to send friend request.");
    } finally {
      setSuggestionBusyId(null);
    }
  };

  const handleRemoveSuggestion = (suggestionId: string) => {
    setRemovedSuggestionIds((prev) => new Set(prev).add(suggestionId));
    showToast({ message: "Suggestion hidden.", tone: "info" });
  };

  const visibleSuggestions = suggestions.filter((s) => !removedSuggestionIds.has(s.id));
  const incomingCount = requests.incoming.length;
  const Person = isDesktop ? FriendPersonCard : FriendPersonRow;

  const renderSuggestion = (item: FriendSuggestion) => {
    const isSent = sentSuggestionIds.has(item.id);
    const isBusy = suggestionBusyId === item.id;
    const name = item.full_name || item.username || "Student";
    const subtitle =
      item.mutual_count && item.mutual_count > 0
        ? `${item.mutual_count} mutual friend${item.mutual_count > 1 ? "s" : ""}`
        : item.department_name || item.course_name || "LCCB Student";

    return (
      <Person
        key={item.id}
        name={name}
        subtitle={subtitle}
        avatarUrl={item.avatar_url}
        onPress={() => router.push(`/profile/${item.id}`)}
        actions={
          isDesktop ? (
            <>
              <Button
                label={isSent ? "Request sent" : "Add friend"}
                variant={isSent ? "secondary" : "primary"}
                size="sm"
                loading={isBusy}
                disabled={isSent}
                onPress={() => void handleAddSuggestion(item.id)}
                style={{ flex: 1 }}
              />
              {!isSent ? (
                <Button
                  label="Remove"
                  variant="secondary"
                  size="sm"
                  onPress={() => handleRemoveSuggestion(item.id)}
                />
              ) : null}
            </>
          ) : (
            <>
              {!isSent ? (
                <IconAction
                  icon={X}
                  label={`Hide suggestion for ${name}`}
                  onPress={() => handleRemoveSuggestion(item.id)}
                />
              ) : null}
              <IconAction
                icon={isSent ? Check : UserPlus}
                label={isSent ? "Request sent" : `Add ${name} as a friend`}
                disabled={isBusy || isSent}
                onPress={() => void handleAddSuggestion(item.id)}
              />
            </>
          )
        }
      />
    );
  };

  const renderRequest = (item: FriendRequests["incoming"][number]) => {
    const name = item.requester.full_name || item.requester.username || "Student";
    const isBusy = processingId === item.id;

    return (
      <Person
        key={item.id}
        name={name}
        subtitle={item.requester.department_name || "Wants to be friends"}
        avatarUrl={item.requester.avatar_url}
        onPress={() => router.push(`/profile/${item.requester.id}`)}
        actions={
          isDesktop ? (
            <>
              <Button
                label="Confirm"
                variant="primary"
                size="sm"
                loading={isBusy}
                onPress={() => void respond(item.id, "accept")}
                style={{ flex: 1 }}
              />
              <Button
                label="Delete"
                variant="secondary"
                size="sm"
                disabled={isBusy}
                onPress={() => void respond(item.id, "decline")}
              />
            </>
          ) : (
            <>
              <IconAction
                icon={X}
                label={`Decline request from ${name}`}
                disabled={isBusy}
                onPress={() => void respond(item.id, "decline")}
              />
              <IconAction
                icon={Check}
                label={`Accept request from ${name}`}
                disabled={isBusy}
                onPress={() => void respond(item.id, "accept")}
              />
            </>
          )
        }
      />
    );
  };

  const renderFriend = (item: Friend) => {
    const name = item.peer.full_name || item.peer.username || "Friend";

    return (
      <Person
        key={item.peer.id}
        name={name}
        subtitle={item.peer.department_name || "LCCB Campus"}
        avatarUrl={item.peer.avatar_url}
        mode={modeOf(item.peer.id)}
        showPresence
        onPress={() => router.push(`/profile/${item.peer.id}`)}
        actions={
          isDesktop ? (
            <>
              <Button
                label="Message"
                variant="primary"
                size="sm"
                icon={MessageSquare}
                onPress={() => void startChat(item.peer)}
                style={{ flex: 1 }}
              />
              <IconAction
                icon={UserMinus}
                label={`Remove ${name} from friends`}
                tone="danger"
                onPress={() => handleRemove(item)}
              />
            </>
          ) : (
            <>
              <IconAction
                icon={MessageSquare}
                label={`Message ${name}`}
                onPress={() => void startChat(item.peer)}
              />
              <IconAction
                icon={UserMinus}
                label={`Remove ${name} from friends`}
                tone="danger"
                onPress={() => handleRemove(item)}
              />
            </>
          )
        }
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        contentContainerStyle={{
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
          paddingHorizontal: SPACE.x4,
          paddingTop: isDesktop ? SPACE.x5 : SPACE.x2,
          paddingBottom: isDesktop ? SPACE.x12 : 100,
        }}
      >
        {/* Page header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.x3,
            marginBottom: SPACE.x4,
          }}
        >
          {!isDesktop ? (
            <Pressable
              onPress={() => safeBack("/(tabs)")}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
            >
              <ArrowLeft size={22} color={colors.ink} />
            </Pressable>
          ) : null}

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Network</Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2, flexWrap: "wrap" }}
            >
              <Text style={{ ...TYPE.h2, color: colors.ink }}>Friends</Text>
              {incomingCount > 0 ? <StatusBadge label={`${incomingCount} new`} tone="brand" /> : null}
            </View>
            {isDesktop ? (
              <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x1 }}>
                Requests, classmates you may know, and everyone in your circle.
              </Text>
            ) : null}
          </View>

          {isDesktop ? (
            <Button
              label="Find friends"
              icon={UserPlus}
              variant="secondary"
              size="sm"
              onPress={() => router.push("/find-friends")}
            />
          ) : (
            <IconAction
              icon={UserPlus}
              label="Find friends"
              tone="brand"
              onPress={() => router.push("/find-friends")}
            />
          )}
        </View>

        <FriendsTabs
          value={activeTab}
          onChange={setActiveTab}
          counts={{
            requests: incomingCount,
            suggestions: visibleSuggestions.length,
            all: friends.length,
          }}
        />

        <View style={{ marginTop: SPACE.x5 }}>
          {loading ? (
            <View style={{ paddingVertical: SPACE.x12, alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.brand} />
            </View>
          ) : activeTab === "requests" ? (
            <View style={{ gap: SPACE.x8 }}>
              <View>
                <SectionHeader
                  title={
                    incomingCount > 0 ? `Friend requests (${incomingCount})` : "Friend requests"
                  }
                  description="People who would like to connect with you."
                />
                {incomingCount > 0 ? (
                  <PersonGrid isDesktop={isDesktop}>
                    {requests.incoming.map(renderRequest)}
                  </PersonGrid>
                ) : (
                  <EmptyState
                    icon={UserPlus}
                    title="No pending requests"
                    body="When someone asks to connect, their request will show up here."
                    compact={!isDesktop}
                  />
                )}
              </View>

              {visibleSuggestions.length > 0 ? (
                <View>
                  <SectionHeader
                    title="People you may know"
                    description="Classmates from your department and beyond."
                  />
                  <PersonGrid isDesktop={isDesktop}>
                    {visibleSuggestions.map(renderSuggestion)}
                  </PersonGrid>
                </View>
              ) : null}
            </View>
          ) : activeTab === "suggestions" ? (
            <View>
              <SectionHeader
                title="People you may know"
                description="Classmates from your department and beyond."
              />
              {visibleSuggestions.length > 0 ? (
                <PersonGrid isDesktop={isDesktop}>
                  {visibleSuggestions.map(renderSuggestion)}
                </PersonGrid>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No suggestions right now"
                  body="Check back later for classmates in your department."
                  compact={!isDesktop}
                />
              )}
            </View>
          ) : (
            <View>
              <SectionHeader
                title={friends.length > 0 ? `All friends (${friends.length})` : "All friends"}
                description="Everyone you have connected with on campus."
              />
              {friends.length > 0 ? (
                <PersonGrid isDesktop={isDesktop}>{friends.map(renderFriend)}</PersonGrid>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No friends yet"
                  body="Start with people you may know, or search the campus directory."
                  actionLabel="Find friends"
                  onAction={() => router.push("/find-friends")}
                  compact={!isDesktop}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

/** Cards wrap into a grid on desktop; rows stack on narrower screens. */
function PersonGrid({ isDesktop, children }: { isDesktop: boolean; children: ReactNode }) {
  return (
    <View style={isDesktop ? { flexDirection: "row", flexWrap: "wrap", gap: SPACE.x4 } : { gap: SPACE.x2 }}>
      {children}
    </View>
  );
}

/** Soft circular control for row/card secondary actions. */
function IconAction({
  icon: Icon,
  label,
  onPress,
  tone = "neutral",
  disabled = false,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  tone?: "neutral" | "brand" | "danger";
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const tint =
    tone === "danger" ? colors.destructive : tone === "brand" ? colors.brand : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed, hovered }: any) => [
        {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor:
            tone === "brand" && !disabled ? colors.brandWash : colors.surfaceSunken,
          opacity: disabled ? 0.5 : pressed || hovered ? 0.85 : 1,
          cursor: disabled ? "default" : "pointer",
          transform: [{ scale: pressed && !disabled ? 0.94 : 1 }],
        } as ViewStyle,
        focusRing(colors, focused),
      ]}
    >
      <Icon size={17} color={tint} strokeWidth={2.1} />
    </Pressable>
  );
}
