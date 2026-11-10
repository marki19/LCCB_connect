import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, UserPlus, MessageSquare, Check, X, UserMinus, Users } from "lucide-react-native";
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
import { RADIUS, SPACE, TYPE } from "../src/lib/tokens";
import Button, { IconButton } from "../src/components/ui/Button";
import Card from "../src/components/ui/Card";
import Modal from "../src/components/ui/Modal";
import EmptyState from "../src/components/admin/EmptyState";

/**
 * Friends (Messaging_plan.md §5): mutual request → accept. Accepted friends
 * bypass the recipient's "who can message me" policy.
 */

export default function FriendsScreen() {
  const router = useRouter();
  const { modeOf } = usePresence();
  const { colors } = useTheme();

  const [tab, setTab] = useState<"friends" | "requests">("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<Friend | null>(null);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
      setNotice(err instanceof Error ? err.message : "Please try again.");
    }
  };

  const performRemove = async () => {
    if (!friendToRemove) return;
    setRemoving(true);
    try {
      await removeFriend(friendToRemove.peer.id);
      await load();
      setFriendToRemove(null);
    } catch {
      setFriendToRemove(null);
      setNotice("Could not remove this friend. Please try again.");
    } finally {
      setRemoving(false);
    }
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
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x3,
          paddingHorizontal: SPACE.x4,
          minHeight: 64,
          backgroundColor: colors.panel,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <IconButton icon={ArrowLeft} label="Back" onPress={() => safeBack("/(tabs)")} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>Network</Text>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Friends</Text>
        </View>
        <IconButton
          icon={UserPlus}
          label="Add a friend"
          variant="subtle"
          onPress={() => setPickerOpen(true)}
        />
      </View>

      <View style={{ width: "100%", maxWidth: 760, alignSelf: "center", flex: 1 }}>
        {/* Tabs */}
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: "row",
            paddingHorizontal: SPACE.x4,
            paddingTop: SPACE.x4,
            gap: SPACE.x2,
          }}
        >
          {(["friends", "requests"] as const).map((key) => {
            const active = tab === key;
            const badge = key === "requests" ? requestCount : 0;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityLabel={
                  key === "friends" ? `Friends, ${friends.length}` : `Requests, ${requestCount}`
                }
                accessibilityState={{ selected: active }}
                onFocus={() => {}}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 40,
                  paddingHorizontal: SPACE.x4,
                  borderRadius: RADIUS.pill,
                  borderWidth: 1,
                  borderColor: active ? colors.brandSolid : colors.line,
                  backgroundColor: active
                    ? colors.brandSolid
                    : pressed
                    ? colors.surfaceSunken
                    : colors.panel,
                })}
              >
                <Text
                  style={{
                    ...TYPE.caption,
                    fontWeight: "700",
                    color: active ? colors.textOnBrandSolid : colors.inkSoft,
                  }}
                >
                  {key === "friends" ? `Friends (${friends.length})` : "Requests"}
                </Text>
                {badge > 0 && (
                  <View
                    style={{
                      marginLeft: SPACE.x2,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: active ? colors.textOnBrandSolid : colors.coral,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 5,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: active ? colors.brandSolid : colors.textOnDanger,
                      }}
                    >
                      {badge}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.primary} />
          </View>
        ) : tab === "friends" ? (
          <FlatList
            style={{ flex: 1, marginTop: SPACE.x4 }}
            data={data}
            keyExtractor={(item) => item.peer.id}
            contentContainerStyle={{
              paddingHorizontal: SPACE.x4,
              paddingBottom: SPACE.x10,
              gap: SPACE.x2,
              flexGrow: 1,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            renderItem={({ item }) => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.x3,
                  padding: SPACE.x4,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.panel,
                }}
              >
                <Avatar
                  name={item.peer.full_name || item.peer.username}
                  size={48}
                  showPresence
                  mode={modeOf(item.peer.id)}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink }}
                  >
                    {item.peer.full_name || item.peer.username || "Friend"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2 }}
                  >
                    {item.peer.department_name || "No department"}
                  </Text>
                </View>
                <IconButton
                  icon={MessageSquare}
                  label={`Message ${item.peer.full_name || item.peer.username || "friend"}`}
                  variant="subtle"
                  size={38}
                  onPress={() => void startChat(item.peer)}
                />
                <Pressable
                  onPress={() => setFriendToRemove(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.peer.full_name || item.peer.username || "friend"}`}
                  onFocus={() => {}}
                  style={({ pressed }) => ({
                    width: 38,
                    height: 38,
                    borderRadius: RADIUS.md,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.destructiveSurface,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <UserMinus size={17} color={colors.destructive} />
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              <Card style={{ marginTop: SPACE.x4 }}>
                <EmptyState
                  icon={Users}
                  tone="brand"
                  compact
                  title="No friends yet"
                  body="Add people to message them regardless of their messaging policy."
                  actionLabel="Add a friend"
                  onAction={() => setPickerOpen(true)}
                />
              </Card>
            }
          />
        ) : (
          <FlatList
            style={{ flex: 1, marginTop: SPACE.x4 }}
            data={requests.incoming}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: SPACE.x4,
              paddingBottom: SPACE.x10,
              gap: SPACE.x2,
              flexGrow: 1,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListHeaderComponent={
              requests.incoming.length > 0 ? (
                <Text style={{ ...TYPE.micro, color: colors.inkFaint, paddingHorizontal: SPACE.x1 }}>
                  Incoming
                </Text>
              ) : undefined
            }
            renderItem={({ item }) => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.x3,
                  padding: SPACE.x4,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.panel,
                }}
              >
                <Avatar
                  name={item.requester.full_name || item.requester.username}
                  size={48}
                  showPresence
                  mode={modeOf(item.requester.id)}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink }}
                  >
                    {item.requester.full_name || item.requester.username || "Someone"}
                  </Text>
                  <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2 }}>
                    Wants to be friends
                  </Text>
                </View>
                <IconButton
                  icon={X}
                  label={`Decline request from ${
                    item.requester.full_name || item.requester.username || "someone"
                  }`}
                  variant="secondary"
                  size={38}
                  onPress={() => void respond(item.id, "decline")}
                />
                <Pressable
                  onPress={() => void respond(item.id, "accept")}
                  accessibilityRole="button"
                  accessibilityLabel={`Accept request from ${
                    item.requester.full_name || item.requester.username || "someone"
                  }`}
                  onFocus={() => {}}
                  style={({ pressed }) => ({
                    width: 38,
                    height: 38,
                    borderRadius: RADIUS.md,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.brandSolid,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Check size={17} color={colors.textOnBrandSolid} />
                </Pressable>
              </View>
            )}
            ListFooterComponent={
              requests.outgoing.length > 0 ? (
                <View style={{ marginTop: SPACE.x4, gap: SPACE.x2 }}>
                  <Text
                    style={{ ...TYPE.micro, color: colors.inkFaint, paddingHorizontal: SPACE.x1 }}
                  >
                    Sent
                  </Text>
                  {requests.outgoing.map((item) => (
                    <View
                      key={item.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: SPACE.x3,
                        padding: SPACE.x4,
                        borderRadius: RADIUS.lg,
                        borderWidth: 1,
                        borderColor: colors.line,
                        backgroundColor: colors.panel,
                      }}
                    >
                      <Avatar name={item.addressee.full_name || item.addressee.username} size={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={{ ...TYPE.bodyStrong, fontWeight: "700", color: colors.ink }}
                        >
                          {item.addressee.full_name || item.addressee.username || "Someone"}
                        </Text>
                        <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 2 }}>
                          Pending
                        </Text>
                      </View>
                      <Button
                        label="Cancel"
                        variant="ghost"
                        size="sm"
                        onPress={() => void respond(item.id, "decline")}
                      />
                    </View>
                  ))}
                </View>
              ) : undefined
            }
            ListEmptyComponent={
              requests.outgoing.length === 0 ? (
                <Card style={{ marginTop: SPACE.x4 }}>
                  <EmptyState
                    icon={UserPlus}
                    tone="neutral"
                    compact
                    title="No friend requests"
                    body="When someone asks to connect, their request will appear here."
                  />
                </Card>
              ) : undefined
            }
          />
        )}
      </View>

      <PeerPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onOpened={(id) => router.push(`/messages/${id}`)}
        mode="friend"
      />

      {/* Remove friend confirmation */}
      <Modal
        visible={!!friendToRemove}
        onClose={() => {
          if (!removing) setFriendToRemove(null);
        }}
        maxWidth={440}
        accessibilityLabel="Remove friend confirmation"
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Remove friend?</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            Remove{" "}
            {friendToRemove?.peer.full_name || friendToRemove?.peer.username || "this person"} from
            your friends?
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: SPACE.x3,
              marginTop: SPACE.x5,
            }}
          >
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => setFriendToRemove(null)}
              disabled={removing}
            />
            <Button
              label="Remove"
              variant="danger"
              onPress={() => void performRemove()}
              loading={removing}
            />
          </View>
        </View>
      </Modal>

      {/* Notice */}
      <Modal
        visible={!!notice}
        onClose={() => setNotice(null)}
        maxWidth={420}
        accessibilityLabel="Notice"
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Cannot message</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>{notice}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
            <Button label="Got it" onPress={() => setNotice(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
