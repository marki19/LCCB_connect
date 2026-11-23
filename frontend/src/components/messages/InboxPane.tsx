import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  StyleSheet,
} from "react-native";
import {
  ArrowLeft,
  SquarePen,
  Search,
  Plus,
  Inbox,
  Clock,
  X,
  Trash2,
} from "lucide-react-native";
import Avatar from "../Avatar";
import PeerPicker from "../PeerPicker";
import QuickSnapComposer from "../snaps/QuickSnapComposer";
import Modal from "../ui/Modal";
import Button, { IconButton } from "../ui/Button";
import { usePresence } from "../../contexts/PresenceContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { onConversation, onMessage } from "../../lib/realtime";
import {
  acceptConversation,
  listConversations,
  listRequests,
  listFriends,
  openConversation,
  markRead,
} from "../../lib/messages";
import { updateNote, deleteNote } from "../../lib/api";
import { formatMessagePreview } from "../../lib/chatMedia";
import type { Conversation, Friend } from "../../types";
import { RADIUS, SPACE, TYPE } from "../../lib/tokens";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import TabPill from "../ui/TabPill";

type InboxPaneProps = {
  onSelect: (conversationId: string) => void;
  /** Highlighted thread in the desktop split view. */
  activeId?: string | null;
  /** Show the back affordance (full-page presentation only). */
  showBack?: boolean;
  onBack?: () => void;
};

const formatWhen = (iso?: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function InboxPane({
  onSelect,
  activeId = null,
  showBack = false,
  onBack,
}: InboxPaneProps) {
  const { modeOf } = usePresence();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [tabChoice, setTabChoice] = useState<"chats" | "requests" | null>(null);

const handleTabChange = (value: string) => {
  if (value === "chats" || value === "requests") {
    setTabChoice(value);
  }
};
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [received, setReceived] = useState<Conversation[]>([]);
  const [sent, setSent] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Quick Snap & Note state
  const [snapComposerOpen, setSnapComposerOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [userNote, setUserNote] = useState<string | null>(profile?.note ?? null);
  const [noteDraft, setNoteDraft] = useState(profile?.note ?? "");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setUserNote(profile?.note ?? null);
    setNoteDraft(profile?.note ?? "");
  }, [profile?.note]);

  const handleCloseNoteModal = useCallback(() => {
    if (!savingNote) setNoteModalOpen(false);
  }, [savingNote]);

  const handleSaveNote = async () => {
    const clean = noteDraft.trim();
    if (!clean && !userNote) return;
    setSavingNote(true);
    try {
      if (clean.length === 0) {
        await deleteNote();
        setUserNote(null);
        setNoteDraft("");
        showToast({ message: "Note removed", tone: "info" });
      } else {
        await updateNote(clean);
        setUserNote(clean);
        showToast({ message: "Note shared!", tone: "success" });
      }
      setNoteModalOpen(false);
    } catch (err: any) {
      showToast({ message: err?.message || "Failed to update note", tone: "error" });
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async () => {
    setSavingNote(true);
    try {
      await deleteNote();
      setUserNote(null);
      setNoteDraft("");
      showToast({ message: "Note deleted", tone: "info" });
      setNoteModalOpen(false);
    } catch (err: any) {
      showToast({ message: err?.message || "Failed to delete note", tone: "error" });
    } finally {
      setSavingNote(false);
    }
  };

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [chats, requests, friendList] = await Promise.all([
        listConversations().catch(() => []),
        listRequests().catch(() => ({ received: [], sent: [] })),
        listFriends(30).catch(() => []),
      ]);
      setConversations(chats);
      setReceived(requests.received);
      setSent(requests.sent);
      setFriends(friendList);
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
        const [chats, requests, friendList] = await Promise.all([
          listConversations().catch(() => []),
          listRequests().catch(() => ({ received: [], sent: [] })),
          listFriends(30).catch(() => []),
        ]);
        if (cancelled) return;
        setConversations(chats);
        setReceived(requests.received);
        setSent(requests.sent);
        setFriends(friendList);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Coalesce realtime bursts into one refetch.
  useEffect(() => {
    const schedule = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => void load(), 400);
    };
    const offConversation = onConversation(schedule);
    const offMessage = onMessage(schedule);
    return () => {
      offConversation();
      offMessage();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [load]);

  const activeIsRequest =
    !!activeId &&
    !conversations.some((c) => c.id === activeId) &&
    (received.some((c) => c.id === activeId) || sent.some((c) => c.id === activeId));
  const tab: "chats" | "requests" = tabChoice ?? (activeIsRequest ? "requests" : "chats");

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const openThread = (id: string) => {
    void markRead(id).catch(() => undefined);
    onSelect(id);
  };

  const handleStartFriendChat = async (peerId: string) => {
    try {
      const conv = await openConversation(peerId);
      if (conv?.id) {
        onSelect(conv.id);
      }
    } catch {
      setPickerOpen(true);
    }
  };

  const handleAccept = async (conversation: Conversation) => {
    try {
      await acceptConversation(conversation.id);
      await load();
    } catch {
      // Best effort
    }
  };

  const pendingCount = received.length;

  const query = searchQuery.trim().toLowerCase();

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!query) return conversations;
    return conversations.filter((c) => {
      const name = c.peer?.full_name || c.peer?.username || "";
      const lastMsg = formatMessagePreview(c.last_message?.body);
      return name.toLowerCase().includes(query) || lastMsg.toLowerCase().includes(query);
    });
  }, [conversations, query]);

  const filteredReceived = useMemo(() => {
    if (!query) return received;
    return received.filter((c) => {
      const name = c.peer?.full_name || c.peer?.username || "";
      const lastMsg = formatMessagePreview(c.last_message?.body);
      return name.toLowerCase().includes(query) || lastMsg.toLowerCase().includes(query);
    });
  }, [received, query]);

  const filteredSent = useMemo(() => {
    if (!query) return sent;
    return sent.filter((c) => {
      const name = c.peer?.full_name || c.peer?.username || "";
      const lastMsg = formatMessagePreview(c.last_message?.body);
      return name.toLowerCase().includes(query) || lastMsg.toLowerCase().includes(query);
    });
  }, [sent, query]);

  // Combine friends and recent conversation peers for the top active rail
  const activeRailPeers = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    friends.forEach((f) => {
      const p = f.peer || (f as any).user || f;
      if (p?.id && p.id !== profile?.id && !seen.has(p.id)) {
        seen.add(p.id);
        list.push(p);
      }
    });

    conversations.forEach((c) => {
      const p = c.peer;
      if (p?.id && p.id !== profile?.id && !seen.has(p.id)) {
        seen.add(p.id);
        list.push(p);
      }
    });

    return list;
  }, [friends, conversations, profile?.id]);

  type RequestRowItem = {
    id: string;
    kind: "received" | "sent";
    isFirstOfKind: boolean;
    conversation: Conversation;
  };

  const requestList = useMemo<RequestRowItem[]>(() => {
    const list: RequestRowItem[] = [];
    filteredReceived.forEach((conv: Conversation, index: number) => {
      list.push({
        id: `recv-${conv.id}`,
        kind: "received",
        isFirstOfKind: index === 0,
        conversation: conv,
      });
    });
    filteredSent.forEach((conv: Conversation, index: number) => {
      list.push({
        id: `sent-${conv.id}`,
        kind: "sent",
        isFirstOfKind: index === 0,
        conversation: conv,
      });
    });
    return list;
  }, [filteredReceived, filteredSent]);

  const renderActiveFriends = () => (
    <View style={styles.snapsSection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.snapsContainer}
      >
        {/* Current user: Quick Snap / note */}
        <View style={styles.snapItem}>
          {/* Note speech bubble perched above avatar */}
          <Pressable
            onPress={() => {
              setNoteDraft(userNote || "");
              setNoteModalOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={userNote ? `Your note: ${userNote}` : "Share a note"}
            style={({ pressed, hovered }: any) => [
              styles.noteBubble,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
                cursor: "pointer",
                opacity: pressed ? 0.8 : hovered ? 0.95 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <Text numberOfLines={1} style={[styles.noteText, { color: userNote ? colors.ink : colors.inkSoft }]}>
              {userNote || "Share a note..."}
            </Text>
            <View
              style={[
                styles.noteBubbleTail,
                { borderTopColor: colors.surfaceSunken },
              ]}
            />
          </Pressable>

          <Pressable
            style={({ pressed, hovered }: any) => [
              styles.snapAvatarWrap,
              {
                cursor: "pointer",
                opacity: pressed ? 0.85 : hovered ? 0.95 : 1,
              },
            ]}
            onPress={() => setSnapComposerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Add a Quick Snap"
          >
            <Avatar
              name={profile?.full_name || profile?.username}
              avatarUrl={profile?.avatar_url}
              size={58}
            />
            <View style={[styles.snapPlusBadge, { backgroundColor: colors.surfaceSunken, borderColor: colors.surfacePage }]}>
              <Plus size={12} color="#FFFFFF" strokeWidth={3} />
            </View>
          </Pressable>

          <Text numberOfLines={1} style={[styles.snapName, { color: colors.inkFaint }]}>
            Your snap
          </Text>
        </View>

        {/* Friends' snaps and active status */}
        {activeRailPeers.map((peer) => {
          const isOnline = modeOf(peer.id) === "online";
          const firstName = (peer.full_name || peer.username || "Friend").split(" ")[0];
          const hasNote = Boolean(peer.note && peer.note.trim().length > 0);

          return (
            <Pressable
              key={peer.id}
              style={({ pressed, hovered }: any) => [
                styles.snapItem,
                {
                  cursor: "pointer",
                  opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
              onPress={() => handleStartFriendChat(peer.id)}
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${firstName}`}
            >
              {/* Note or greeting speech bubble perched above avatar */}
              <View
                style={[
                  styles.noteBubble,
                  {
                    backgroundColor: colors.surfaceSunken,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.noteText,
                    { color: hasNote ? colors.ink : colors.inkSoft },
                  ]}
                >
                  {hasNote ? peer.note : isOnline ? "Active" : "👋"}
                </Text>
                <View
                  style={[
                    styles.noteBubbleTail,
                    { borderTopColor: colors.surfaceSunken },
                  ]}
                />
              </View>

              <View style={styles.snapAvatarWrap}>
                <Avatar
                  name={peer.full_name || peer.username}
                  avatarUrl={peer.avatar_url}
                  size={58}
                />
                {isOnline ? (
                  <View
                    style={[
                      styles.onlineDot,
                      {
                        backgroundColor: colors.presenceOnline,
                        borderColor: colors.surfacePage,
                      },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.elapsedBadge,
                      {
                        backgroundColor: colors.surfaceSunken,
                        borderColor: colors.surfacePage,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 9, fontWeight: "700", color: colors.presenceOnline }}>
                      12m
                    </Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} style={[styles.snapName, { color: colors.ink, fontWeight: "600" }]}>
                {firstName}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderChat = (item: Conversation) => {
    const peer = item.peer;
    const active = activeId === item.id;
    const isOnline = peer ? modeOf(peer.id) === "online" : false;
    const hasUnread = item.unread > 0;
    const isFromMe = item.last_message?.sender_id === profile?.id;
    const previewBody = formatMessagePreview(item.last_message?.body);
    const snippetText = item.last_message
      ? `${isFromMe ? "You: " : ""}${previewBody}`
      : "Started a conversation";

    return (
      <Pressable
        key={item.id}
        onPress={() => openThread(item.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={({ pressed, hovered }: any) => [
          styles.chatRow,
          {
            cursor: "pointer",
            backgroundColor: active
              ? colors.primarySurface
              : pressed || hovered
              ? colors.hoverOverlay
              : "transparent",
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View style={styles.avatarContainer}>
          <Avatar
            name={peer?.full_name || peer?.username}
            avatarUrl={peer?.avatar_url}
            size={54}
          />
          {isOnline ? (
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: colors.presenceOnline, borderColor: colors.surfacePage },
              ]}
            />
          ) : null}
        </View>

        <View style={styles.chatDetails}>
          <View style={styles.chatHeaderRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.chatName,
                {
                  color: colors.ink,
                  fontWeight: hasUnread ? "800" : "600",
                },
              ]}
            >
              {peer?.full_name || peer?.username || "Peer"}
            </Text>
            <Text
              style={[
                styles.chatTime,
                { color: hasUnread ? colors.brand : colors.inkFaint, fontWeight: hasUnread ? "700" : "400" },
              ]}
            >
              {formatWhen(item.last_message?.created_at || item.last_message_at)}
            </Text>
          </View>

          <View style={styles.chatSnippetRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.chatSnippet,
                {
                  color: hasUnread ? colors.ink : colors.inkSoft,
                  fontWeight: hasUnread ? "700" : "400",
                },
              ]}
            >
              {snippetText}
            </Text>
            {hasUnread ? (
              <View style={[styles.unreadDotBlue, { backgroundColor: colors.brand }]} />
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };
  const renderRequest = (item: Conversation, kind: "received" | "sent") => {
    const peer = item.peer;
    const active = activeId === item.id;
    const isOnline = peer ? modeOf(peer.id) === "online" : false;
    const lastMsg = formatMessagePreview(item.last_message?.body);

    return (
      <Pressable
        key={item.id}
        onPress={() => openThread(item.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={({ pressed, hovered }: any) => [
          styles.chatRow,
          {
            cursor: "pointer",
            backgroundColor: active
              ? colors.primarySurface
              : pressed || hovered
              ? colors.hoverOverlay
              : "transparent",
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View style={styles.avatarContainer}>
          <Avatar
            name={peer?.full_name || peer?.username}
            avatarUrl={peer?.avatar_url}
            size={54}
          />
          {isOnline ? (
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: colors.presenceOnline, borderColor: colors.surfacePage },
              ]}
            />
          ) : null}
        </View>

        <View style={styles.chatDetails}>
          <View style={styles.chatHeaderRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.chatName,
                {
                  color: colors.ink,
                  fontWeight: "700",
                },
              ]}
            >
              {peer?.full_name || peer?.username || "Peer"}
            </Text>
            <Text style={[styles.chatTime, { color: colors.inkFaint }]}>
              {formatWhen(item.last_message?.created_at || item.last_message_at || item.created_at)}
            </Text>
          </View>

          <View style={styles.chatSnippetRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.chatSnippet,
                {
                  color: colors.inkSoft,
                },
              ]}
            >
              {kind === "sent"
                ? lastMsg
                  ? (item.last_message?.sender_id === peer?.id ? lastMsg : `You: ${lastMsg}`)
                  : "You sent a request"
                : lastMsg || "Wants to send you a message"}
            </Text>
          </View>

          {kind === "sent" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Clock size={11} color={colors.inkFaint} />
              <Text style={{ ...TYPE.micro, color: colors.inkFaint, fontWeight: "600" }}>
                Pending request...
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: SPACE.x2, marginTop: 4 }}>
              <Button
                label="Accept"
                variant="primary"
                size="sm"
                onPress={() => {
                  void handleAccept(item);
                }}
              />
              <Button
                label="View"
                variant="ghost"
                size="sm"
                onPress={() => {
                  openThread(item.id);
                }}
              />
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      {/* Messenger Mobile / Desktop Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.line,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2 }}>
          {showBack ? (
            <IconButton icon={ArrowLeft} label="Back" onPress={onBack ?? (() => {})} />
          ) : null}
          <Text style={[TYPE.h2, { color: colors.ink }, styles.headerTitle]}>Messages</Text>
        </View>

        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="New message"
          style={({ pressed, hovered }: any) => [
            styles.newChatBtn,
            {
              backgroundColor: colors.surfaceSunken,
              cursor: "pointer",
              opacity: pressed ? 0.75 : hovered ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
        >
          <SquarePen size={19} color={colors.ink} />
        </Pressable>
      </View>

      <View style={{ flex: 1, width: "100%" }}>
        {/* Search Bar */}
        <View style={styles.searchWrap}>
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceSunken, borderColor: colors.line }]}>
            <Search size={18} color={colors.inkFaint} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search"
              placeholderTextColor={colors.inkFaint}
              style={[styles.searchInput, { color: colors.ink }]}
              accessibilityLabel="Search"
            />
          </View>
        </View>

        {/* Tab Pills: Chats / Requests */}
        <View style={styles.tabsRow}>
          <TabPill
            options={[
              { value: "chats", label: "Chats" },
              { value: "requests", label: "Requests", badgeCount: pendingCount },
            ]}
            value={tab}
            onChange={handleTabChange}
            variant="pill"
          />
        </View>

        {/* Main List */}
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="small" color={colors.brand} />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={tab === "chats" ? (filteredConversations as any) : (requestList as any)}
            keyExtractor={(item: any) => item.id}
            ListHeaderComponent={tab === "chats" ? renderActiveFriends : undefined}
            contentContainerStyle={{ paddingBottom: SPACE.x8, flexGrow: 1 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
            }
            renderItem={({ item }: { item: any }) => {
              if (tab === "chats") {
                return renderChat(item as Conversation);
              }
              const req = item as RequestRowItem;
              return (
                <View key={req.id}>
                  {req.isFirstOfKind && (
                    <View style={styles.sectionHeader}>
                      <Text style={[styles.sectionHeaderText, { color: colors.inkFaint }]}>
                        {req.kind === "received" ? "RECEIVED REQUESTS" : "SENT REQUESTS"}
                      </Text>
                    </View>
                  )}
                  {renderRequest(req.conversation, req.kind)}
                </View>
              );
            }}
            ListEmptyComponent={
              <Card style={{ margin: SPACE.x4 }}>
                <EmptyState
                  icon={tab === "chats" ? SquarePen : Inbox}
                  tone="brand"
                  compact
                  title={
                    tab === "chats"
                      ? query
                        ? "No conversations found"
                        : "No conversations yet"
                      : query
                      ? "No requests found"
                      : "No message requests"
                  }
                  body={
                    tab === "chats"
                      ? query
                        ? "Try searching for a different name."
                        : "Start chatting with your classmates from the new message button."
                      : query
                      ? "Try searching for a different name."
                      : "Requests from people outside your course or department appear here."
                  }
                  actionLabel={tab === "chats" && !query ? "New message" : undefined}
                  onAction={tab === "chats" && !query ? () => setPickerOpen(true) : undefined}
                />
              </Card>
            }
          />
        )}
      </View>

      <PeerPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onOpened={(id) => openThread(id)}
        mode="message"
      />

      {/* Quick Snap composer (camera / gallery chooser) */}
      <QuickSnapComposer
        visible={snapComposerOpen}
        onClose={() => setSnapComposerOpen(false)}
      />

      {/* Note Editor Modal */}
      <Modal visible={noteModalOpen} onClose={handleCloseNoteModal} maxWidth={420} sheetOnMobile={false}>
        <View style={styles.noteModalCard}>
          <View style={styles.noteModalHeader}>
            <Text style={[styles.noteModalTitle, { color: colors.ink }]}>
              {userNote ? "Edit Note" : "Share a Thought"}
            </Text>
            <Pressable
              onPress={handleCloseNoteModal}
              disabled={savingNote}
              style={({ pressed, hovered }: any) => [
                styles.closeBtn,
                {
                  backgroundColor: colors.surfaceSunken,
                  opacity: pressed ? 0.7 : hovered ? 0.9 : 1,
                },
              ]}
            >
              <X size={16} color={colors.ink} />
            </Pressable>
          </View>

          <Text style={[styles.noteModalSubtitle, { color: colors.inkSoft }]}>
            Notes appear as a speech bubble above your avatar in messages and on your profile.
          </Text>

          <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surfaceSunken }]}>
            <TextInput
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="Share a thought..."
              placeholderTextColor={colors.inkFaint}
              maxLength={60}
              autoFocus
              returnKeyType="send"
              onSubmitEditing={handleSaveNote}
              style={[
                styles.textInput,
                {
                  color: colors.ink,
                  outlineStyle: "none" as any,
                },
              ]}
            />
            <Text style={[styles.charCount, { color: colors.inkFaint }]}>
              {noteDraft.length}/60
            </Text>
          </View>

          <View style={styles.noteModalActions}>
            {userNote ? (
              <Pressable
                onPress={handleDeleteNote}
                disabled={savingNote}
                style={({ pressed, hovered }: any) => [
                  styles.deleteBtn,
                  {
                    borderColor: colors.destructive + "40",
                    backgroundColor: colors.destructive + "12",
                    opacity: pressed ? 0.7 : hovered ? 0.9 : 1,
                  },
                ]}
              >
                <Trash2 size={15} color={colors.destructive} />
                <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>
                  Clear
                </Text>
              </Pressable>
            ) : null}

            <View style={{ flex: 1 }} />

            <Button
              label="Cancel"
              variant="ghost"
              onPress={handleCloseNoteModal}
              disabled={savingNote}
            />
            <Button
              label={savingNote ? "Saving..." : "Share"}
              variant="primary"
              loading={savingNote}
              onPress={handleSaveNote}
              disabled={savingNote || (!userNote && noteDraft.trim().length === 0)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  newChatBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x3,
    paddingBottom: SPACE.x2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: SPACE.x3,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    height: "100%",
    paddingHorizontal: SPACE.x2,
    outlineStyle: "none" as any,
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: SPACE.x4,
    paddingBottom: SPACE.x2,
    gap: SPACE.x2,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x1,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACE.x3,
    paddingVertical: 6,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  badgeDot: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  snapsSection: {
    paddingVertical: SPACE.x3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(150, 150, 150, 0.15)",
    marginBottom: SPACE.x1,
  },
  snapsContainer: {
    paddingHorizontal: SPACE.x4,
    gap: SPACE.x3,
    alignItems: "flex-end",
  },
  snapItem: {
    alignItems: "center",
    width: 74,
    gap: 4,
    position: "relative",
    paddingTop: 24,
  },
  noteBubble: {
    position: "absolute",
    top: 0,
    maxWidth: 82,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  noteBubbleTail: {
    position: "absolute",
    bottom: -4,
    left: "50%",
    marginLeft: -3,
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 4,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  noteText: {
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
  },
  snapAvatarWrap: {
    position: "relative",
  },
  snapPlusBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  elapsedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  snapName: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  sectionHeader: {
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x3,
    paddingBottom: SPACE.x1,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
    paddingHorizontal: SPACE.x4,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  avatarContainer: {
    position: "relative",
  },
  chatDetails: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  chatHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.x2,
  },
  chatName: {
    fontSize: 15.5,
    flex: 1,
  },
  chatTime: {
    fontSize: 12,
  },
  chatSnippetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.x2,
  },
  chatSnippet: {
    fontSize: 13.5,
    flex: 1,
  },
  unreadDotBlue: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  actionBtn: {
    paddingHorizontal: SPACE.x3,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  noteModalCard: {
    padding: SPACE.x5,
    width: "100%",
  },
  noteModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.x1,
  },
  noteModalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  noteModalSubtitle: {
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: SPACE.x4,
  },
  inputContainer: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    marginBottom: SPACE.x4,
  },
  textInput: {
    fontSize: 15,
    minHeight: 38,
  },
  charCount: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  noteModalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x2,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
