import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  Image as RNImage,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  ArrowLeft,
  Send,
  Check,
  CheckCheck,
  Clock,
  ShieldAlert,
  MoreVertical,
  Flag,
  Ban,
  ShieldCheck,
  X,
  Image as ImageIcon,
} from "lucide-react-native";
import Avatar, { PRESENCE_LABELS } from "../../src/components/Avatar";
import { useAuth } from "../../src/contexts/AuthContext";
import { usePresence } from "../../src/contexts/PresenceContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { useConversationRealtime, type PendingMessage } from "../../src/hooks/useConversationRealtime";
import {
  acceptConversation,
  blockUser,
  listBlocked,
  listConversations,
  listRequests,
  reportMessage,
  unblockUser,
} from "../../src/lib/messages";
import { ApiError } from "../../src/lib/api";
import { setActiveConversation } from "../../src/lib/push";
import { messageStatus, type Conversation, type Message } from "../../src/types";
import { safeBack } from "../../src/lib/navigation";
import { pickImage } from "../../src/lib/upload";
import {
  parseMessageContent,
  formatMediaMessage,
  uploadChatImage,
} from "../../src/lib/chatMedia";
import ChatImageBubble from "../../src/components/chat/ChatImageBubble";
import ChatImageLightbox from "../../src/components/chat/ChatImageLightbox";

/**
 * 1:1 thread (Messaging_plan.md §6, §7, §9, §12): bubbles + sent/delivered/seen
 * ticks + typing + the "requested" banner/Accept + offline pending bubbles +
 * trust & safety (report a message, block/unblock the peer).
 */

const REPORT_REASONS = ["Spam", "Harassment", "Inappropriate content", "Scam or fraud"];

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function Ticks({ message }: { message: Message }) {
  const status = messageStatus(message);
  if (status === "seen") return <CheckCheck size={13} color="#BFDBFE" />;
  if (status === "delivered") return <CheckCheck size={13} color="#94A3B8" />;
  return <Check size={13} color="#94A3B8" />;
}

export default function ThreadScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id ?? null;
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { modeOf } = usePresence();
  const { colors, isDark } = useTheme();

  const { messages, pending, loading, peerTyping, send, notifyTyping, loadOlder } =
    useConversationRealtime(conversationId);

  // Foreground push suppression (§10): while this thread is focused, don't show
  // a banner for messages arriving in it.
  useFocusEffect(
    useCallback(() => {
      setActiveConversation(conversationId);
      return () => setActiveConversation(null);
    }, [conversationId])
  );

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ uri: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxData, setLightboxData] = useState<{ url: string; caption?: string } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the thread + peer (works for deep links, not just inbox taps).
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const [chats, requests] = await Promise.all([listConversations(), listRequests()]);
        const found = [...chats, ...requests.received, ...requests.sent].find(
          (c) => c.id === conversationId
        );
        if (!cancelled && found) setConversation(found);
      } catch {
        // Header falls back to a generic label.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const peer = conversation?.peer ?? null;
  const peerName = peer?.full_name || peer?.username || "Conversation";
  const peerMode = peer ? modeOf(peer.id) : null;

  // Has the caller blocked this peer? The server enforces it regardless; this
  // only drives the banner and the disabled composer.
  useEffect(() => {
    const peerId = conversation?.peer?.id;
    if (!peerId) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listBlocked();
        if (!cancelled) setBlocked(rows.some((b) => b.blocked_id === peerId));
      } catch {
        // Leave the default; a send would still be refused server-side.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation?.peer?.id]);

  const isRequester = conversation?.requester_id === userId;
  const isRequested = conversation?.status === "requested";
  // Pre-accept, only the requester may send; a block stops everyone.
  const canReply = !blocked && (!isRequested || isRequester);

  const subtitle = peerTyping
    ? "typing…"
    : peerMode
      ? PRESENCE_LABELS[peerMode]
      : "Offline";

  const displayMessages = useMemo(() => messages, [messages]);

  const handleDraftChange = (text: string) => {
    setDraft(text);
    if (!conversationId) return;
    if (text.trim()) notifyTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => notifyTyping(false), 2000);
  };

  const handlePickPhoto = async () => {
    if (!canReply || sending || uploadingImage) return;
    try {
      const res = await pickImage({ allowsEditing: false });
      if (res?.uri) {
        setAttachedImage({ uri: res.uri });
      }
    } catch (err) {
      console.error("Failed to pick image in messages thread:", err);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if ((!text && !attachedImage) || sending || uploadingImage || !canReply) return;
    setSending(true);

    let payloadBody = text;
    if (attachedImage) {
      setUploadingImage(true);
      try {
        const key = await uploadChatImage(attachedImage.uri, conversationId);
        if (!key) {
          Alert.alert("Upload failed", "Could not upload image. Please try again.");
          setUploadingImage(false);
          setSending(false);
          return;
        }
        payloadBody = formatMediaMessage(key, text);
      } catch (err) {
        console.error("Chat image upload failed:", err);
        Alert.alert("Upload failed", "Could not upload image.");
        setUploadingImage(false);
        setSending(false);
        return;
      } finally {
        setUploadingImage(false);
      }
    }

    setDraft("");
    setAttachedImage(null);
    notifyTyping(false);
    try {
      await send(payloadBody);
    } catch (err) {
      // A 4xx (blocked / validation) is permanent — surface it. A network/5xx
      // failure was queued in the outbox and shows as a pending bubble instead.
      const status = err instanceof ApiError ? err.status : 0;
      if (status >= 400 && status < 500) {
        Alert.alert("Message not sent", err instanceof Error ? err.message : "Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  const latestReportable = useMemo(() => {
    // Prefer the peer's most recent message (what "report this conversation"
    // usually means), else the last message in the thread.
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].sender_id !== userId) return messages[i];
    }
    return messages.length ? messages[messages.length - 1] : null;
  }, [messages, userId]);

  const handleBlock = async () => {
    if (!peer) return;
    setActionBusy(true);
    try {
      await blockUser(peer.id);
      setBlocked(true);
      setSafetyOpen(false);
    } catch (err) {
      Alert.alert("Couldn't block", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const confirmBlock = () => {
    if (!peer) return;
    Alert.alert(
      "Block user",
      `Block ${peerName}? Neither of you will be able to message the other.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Block", style: "destructive", onPress: () => void handleBlock() },
      ]
    );
  };

  const handleUnblock = async () => {
    if (!peer) return;
    setActionBusy(true);
    try {
      await unblockUser(peer.id);
      setBlocked(false);
      setSafetyOpen(false);
    } catch (err) {
      Alert.alert("Couldn't unblock", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const openReport = (message: Message | null) => {
    if (!message) return;
    setReportTarget(message);
    setReportReason("");
    setSafetyOpen(false);
    setReportOpen(true);
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    setActionBusy(true);
    try {
      await reportMessage(reportTarget.id, reportReason.trim() || undefined);
      setReportOpen(false);
      setReportTarget(null);
      Alert.alert("Report submitted", "Thank you — a moderator will review this message.");
    } catch (err) {
      Alert.alert("Couldn't report", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!conversation) return;
    setAccepting(true);
    try {
      await acceptConversation(conversation.id);
      setConversation({ ...conversation, status: "active" });
    } catch {
      // Leave the banner so the user can retry.
    } finally {
      setAccepting(false);
    }
  };

  const renderBubble = (message: Message) => {
    const mine = message.sender_id === userId;
    const parsed = parseMessageContent(message.body);

    if (parsed.isMedia && parsed.mediaUrl) {
      return (
        <TouchableOpacity
          activeOpacity={1}
          onLongPress={() => openReport(message)}
          delayLongPress={350}
          style={{
            flexDirection: "row",
            justifyContent: mine ? "flex-end" : "flex-start",
            marginBottom: 8,
            paddingHorizontal: 12,
          }}
        >
          <ChatImageBubble
            mediaUrl={parsed.mediaUrl}
            caption={parsed.text}
            isMine={mine}
            maxWidth={280}
            onPressImage={(url, cap) => setLightboxData({ url, caption: cap })}
            statusFooter={
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 2, gap: 4 }}>
                <Text style={{ fontSize: 10, color: mine ? colors.textOnActionMuted : colors.textTertiary }}>
                  {formatClock(message.created_at)}
                </Text>
                {mine && <Ticks message={message} />}
              </View>
            }
          />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        activeOpacity={1}
        onLongPress={() => openReport(message)}
        delayLongPress={350}
        style={{
          flexDirection: "row",
          justifyContent: mine ? "flex-end" : "flex-start",
          marginBottom: 8,
          paddingHorizontal: 12,
        }}
      >
        <View
          style={{
            maxWidth: "78%",
            backgroundColor: mine ? colors.bubbleMine : colors.bubblePeer,
            borderRadius: 16,
            borderBottomRightRadius: mine ? 4 : 16,
            borderBottomLeftRadius: mine ? 16 : 4,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: mine ? 0 : 1,
            borderColor: mine ? "transparent" : colors.border,
          }}
        >
          <Text style={{ fontSize: 15, lineHeight: 20, color: mine ? colors.bubbleMineText : colors.bubblePeerText }}>
            {message.body}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 3, gap: 4 }}>
            <Text style={{ fontSize: 10, color: mine ? colors.textOnActionMuted : colors.textTertiary }}>
              {formatClock(message.created_at)}
            </Text>
            {mine && <Ticks message={message} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPending = (item: PendingMessage) => {
    const parsedPending = parseMessageContent(item.body);

    if (parsedPending.isMedia && parsedPending.mediaUrl) {
      return (
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 8, paddingHorizontal: 12 }}>
          <ChatImageBubble
            mediaUrl={parsedPending.mediaUrl}
            caption={parsedPending.text}
            isMine={true}
            sending={true}
            maxWidth={280}
            statusFooter={
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 2, gap: 4 }}>
                <Clock size={11} color="#EEF2FF" />
                <Text style={{ fontSize: 10, color: "#EEF2FF" }}>Sending…</Text>
              </View>
            }
          />
        </View>
      );
    }

    return (
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 8, paddingHorizontal: 12 }}>
        <View
          style={{
            maxWidth: "78%",
            backgroundColor: isDark ? "hsl(215, 60%, 40%)" : "#93B4F5",
            borderRadius: 16,
            borderBottomRightRadius: 4,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ fontSize: 15, lineHeight: 20, color: "#FFFFFF" }}>{item.body}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 3, gap: 4 }}>
            <Clock size={11} color="#EEF2FF" />
            <Text style={{ fontSize: 10, color: "#EEF2FF" }}>Sending…</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity onPress={() => safeBack("/messages")} style={{ padding: 6, marginRight: 4 }}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Avatar name={peerName} size={40} showPresence mode={peerMode} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
            {peerName}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: peerTyping ? colors.action : colors.textTertiary, fontWeight: peerTyping ? "600" : "400" }}>
            {subtitle}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setSafetyOpen(true)} style={{ padding: 8 }}>
          <MoreVertical size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Blocked banner */}
      {blocked && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: isDark ? "hsl(0, 30%, 15%)" : "#FEF2F2",
            borderBottomWidth: 1,
            borderBottomColor: isDark ? "hsl(0, 40%, 25%)" : "#FECACA",
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Ban size={18} color="#DC2626" />
          <Text style={{ flex: 1, fontSize: 12.5, color: isDark ? "hsl(0, 75%, 85%)" : "#991B1B", marginLeft: 8, lineHeight: 17 }}>
            You blocked {peerName}. Unblock to continue messaging.
          </Text>
          <TouchableOpacity
            onPress={() => void handleUnblock()}
            disabled={actionBusy}
            style={{ backgroundColor: "#DC2626", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, opacity: actionBusy ? 0.6 : 1 }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>Unblock</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Requested banner */}
      {isRequested && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: isDark ? "hsl(38, 30%, 15%)" : "#FFFBEB",
            borderBottomWidth: 1,
            borderBottomColor: isDark ? "hsl(38, 40%, 25%)" : "#FDE68A",
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <ShieldAlert size={18} color="#D97706" />
          <Text style={{ flex: 1, fontSize: 12.5, color: isDark ? "hsl(38, 75%, 85%)" : "#92400E", marginLeft: 8, lineHeight: 17 }}>
            {isRequester
              ? "Request sent. You can keep messaging — they'll see it under Requests."
              : "This is a message request. Accept to reply."}
          </Text>
          {!isRequester && (
            <TouchableOpacity
              onPress={handleAccept}
              disabled={accepting}
              style={{ backgroundColor: "#D97706", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, opacity: accepting ? 0.6 : 1 }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>Accept</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="small" color={colors.action} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={{ flex: 1 }}
            data={displayMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 12 }}
            renderItem={({ item }) => renderBubble(item)}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={
              messages.length >= 50 ? (
                <TouchableOpacity onPress={() => void loadOlder()} style={{ alignItems: "center", paddingVertical: 8 }}>
                  <Text style={{ fontSize: 12, color: colors.action, fontWeight: "600" }}>Load earlier messages</Text>
                </TouchableOpacity>
              ) : undefined
            }
            ListFooterComponent={<>{pending.map((p) => <View key={p.clientMsgId}>{renderPending(p)}</View>)}</>}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: 64, paddingHorizontal: 32 }}>
                <Text style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center" }}>
                  No messages yet. Say hello to {peerName}.
                </Text>
              </View>
            }
          />
        )}

        {/* Attachment preview strip */}
        {attachedImage && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: colors.surfaceSunken,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              gap: 10,
            }}
          >
            <View style={{ position: "relative", width: 44, height: 44, borderRadius: 8, overflow: "hidden" }}>
              <RNImage source={{ uri: attachedImage.uri }} style={{ width: "100%", height: "100%" }} />
              <TouchableOpacity
                onPress={() => setAttachedImage(null)}
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: "rgba(0,0,0,0.65)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessibilityLabel="Remove photo"
              >
                <X size={12} color="#FFFFFF" strokeWidth={3} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: colors.textTertiary, fontStyle: "italic", flex: 1 }} numberOfLines={1}>
              Photo attached
            </Text>
          </View>
        )}

        {/* Composer */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 8,
          }}
        >
          <TouchableOpacity
            onPress={handlePickPhoto}
            disabled={!canReply || sending || uploadingImage}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.surfaceSunken,
              alignItems: "center",
              justifyContent: "center",
              opacity: canReply ? 1 : 0.4,
            }}
            accessibilityLabel="Attach photo"
          >
            <ImageIcon size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TextInput
            value={draft}
            onChangeText={handleDraftChange}
            editable={canReply}
            placeholder={
              canReply
                ? attachedImage
                  ? "Add a caption…"
                  : "Message…"
                : blocked
                  ? "You blocked this user"
                  : "Accept the request to reply"
            }
            placeholderTextColor={colors.textTertiary}
            multiline
            style={{
              flex: 1,
              maxHeight: 120,
              backgroundColor: colors.surfaceSunken,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontSize: 15,
              color: colors.textPrimary,
              opacity: canReply ? 1 : 0.6,
            }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={(!draft.trim() && !attachedImage) || !canReply || sending || uploadingImage}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: (draft.trim() || attachedImage) && canReply ? colors.action : colors.surfaceSunken,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {sending || uploadingImage ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send
                size={18}
                color={(draft.trim() || attachedImage) && canReply ? "#FFFFFF" : colors.textTertiary}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Safety actions (report / block) */}
      <Modal visible={safetyOpen} transparent animationType="fade" onRequestClose={() => setSafetyOpen(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setSafetyOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" }}
        >
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textTertiary, letterSpacing: 0.6, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6, textTransform: "uppercase" }}>
              Safety
            </Text>
            <TouchableOpacity
              onPress={() => openReport(latestReportable)}
              disabled={!latestReportable}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, opacity: latestReportable ? 1 : 0.5 }}
            >
              <Flag size={18} color="#D97706" />
              <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>Report message</Text>
            </TouchableOpacity>
            {blocked ? (
              <TouchableOpacity
                onPress={() => void handleUnblock()}
                disabled={actionBusy}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14 }}
              >
                <ShieldCheck size={18} color="#16A34A" />
                <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>Unblock {peerName}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={confirmBlock}
                disabled={actionBusy || !peer}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14 }}
              >
                <Ban size={18} color="#DC2626" />
                <Text style={{ marginLeft: 12, fontSize: 15, fontWeight: "600", color: "#DC2626" }}>Block {peerName}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setSafetyOpen(false)}
              style={{ alignItems: "center", paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report reason */}
      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>Report message</Text>
              <TouchableOpacity onPress={() => setReportOpen(false)} style={{ padding: 4 }}>
                <X size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: colors.textTertiary, marginBottom: 12 }}>
              Tell a moderator why. The other person isn&apos;t told who reported them.
            </Text>

            {reportTarget && (
              <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text numberOfLines={3} style={{ fontSize: 13, color: colors.textSecondary, fontStyle: "italic" }}>
                  {reportTarget.body}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {REPORT_REASONS.map((reason) => {
                const active = reportReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setReportReason(active ? "" : reason)}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: active ? colors.action : colors.surfaceSunken }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#FFFFFF" : colors.textSecondary }}>{reason}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Add details (optional)"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={{ backgroundColor: colors.surfaceSunken, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.textPrimary, minHeight: 64, textAlignVertical: "top" }}
            />

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setReportOpen(false)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void submitReport()} disabled={actionBusy} style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.action, opacity: actionBusy ? 0.6 : 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>Submit report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Lightbox */}
      <ChatImageLightbox
        visible={Boolean(lightboxData)}
        imageUrl={lightboxData?.url || null}
        caption={lightboxData?.caption}
        onClose={() => setLightboxData(null)}
      />
    </SafeAreaView>
  );
}
