import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
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
} from "lucide-react-native";
import Avatar, { PRESENCE_LABELS } from "../Avatar";
import { useAuth } from "../../contexts/AuthContext";
import { usePresence } from "../../contexts/PresenceContext";
import { useTheme } from "../../contexts/ThemeContext";
import Modal from "../ui/Modal";
import { useConversationRealtime, type PendingMessage } from "../../hooks/useConversationRealtime";
import {
  acceptConversation,
  blockUser,
  getConversation,
  listBlocked,
  listConversations,
  listRequests,
  reportMessage,
  unblockUser,
} from "../../lib/messages";
import { ApiError } from "../../lib/api";
import { setActiveConversation } from "../../lib/push";
import { messageStatus, type Conversation, type Message } from "../../types";
import { focusRing, RADIUS, SPACE, TYPE } from "../../lib/tokens";
import Button, { IconButton } from "../ui/Button";
import Card from "../ui/Card";

/**
 * 1:1 thread (Messaging_plan.md §6, §7, §9, §12): bubbles + sent/delivered/seen
 * ticks + typing + the "requested" banner/Accept + offline pending bubbles +
 * trust & safety (report a message, block/unblock the peer).
 *
 * Owns no page chrome: the host route wraps it in a `SafeAreaView` (phone) or
 * drops it into the right pane of the desktop split view. `onBack` is only
 * passed by the full-page presentation.
 */

type ThreadPaneProps = {
  conversationId: string | null;
  onBack?: () => void;
};


const REPORT_REASONS = ["Spam", "Harassment", "Inappropriate content", "Scam or fraud"];

const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function Ticks({ message }: { message: Message }) {
  const { colors } = useTheme();
  const status = messageStatus(message);
  if (status === "seen") return <CheckCheck size={13} color={colors.bubbleMineText} />;
  if (status === "delivered") return <CheckCheck size={13} color={colors.textOnActionMuted} />;
  return <Check size={13} color={colors.textOnActionMuted} />;
}

export default function ThreadPane({ conversationId, onBack }: ThreadPaneProps) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { modeOf } = usePresence();
  const { colors } = useTheme();

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
  const [accepting, setAccepting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the thread + peer (works for deep links, not just inbox taps).
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const direct = await getConversation(conversationId);
        if (!cancelled && direct) {
          setConversation(direct);
          return;
        }
      } catch {
        // Fall back to listing if direct lookup fails
      }
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

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending || !canReply) return;
    setDraft("");
    notifyTyping(false);
    setSending(true);
    try {
      await send(text);
    } catch (err) {
      // A 4xx (blocked / validation) is permanent — surface it. A network/5xx
      // failure was queued in the outbox and shows as a pending bubble instead.
      const status = err instanceof ApiError ? err.status : 0;
      if (status >= 400 && status < 500) {
        setNotice({
          title: "Message not sent",
          message: err instanceof Error ? err.message : "Please try again.",
        });
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
      setConfirmBlockOpen(false);
      setSafetyOpen(false);
    } catch (err) {
      setConfirmBlockOpen(false);
      setNotice({
        title: "Could not block",
        message: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setActionBusy(false);
    }
  };

  const confirmBlock = () => {
    if (!peer) return;
    setSafetyOpen(false);
    setConfirmBlockOpen(true);
  };

  const handleUnblock = async () => {
    if (!peer) return;
    setActionBusy(true);
    try {
      await unblockUser(peer.id);
      setBlocked(false);
      setSafetyOpen(false);
    } catch (err) {
      setNotice({
        title: "Could not unblock",
        message: err instanceof Error ? err.message : "Please try again.",
      });
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
      setNotice({
        title: "Report submitted",
        message: "Thank you — a moderator will review this message.",
      });
    } catch (err) {
      setNotice({
        title: "Could not report",
        message: err instanceof Error ? err.message : "Please try again.",
      });
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
    }
  };

  const renderBubble = (message: Message) => {
    const mine = message.sender_id === userId;
    return (
      <Pressable
        onLongPress={() => openReport(message)}
        delayLongPress={350}
        accessibilityRole="text"
        accessibilityLabel={`${mine ? "You" : peerName}: ${message.body}`}
        style={{
          flexDirection: "row",
          justifyContent: mine ? "flex-end" : "flex-start",
          marginBottom: SPACE.x2,
          paddingHorizontal: SPACE.x3,
        }}
      >
        <View
          style={{
            maxWidth: "78%",
            backgroundColor: mine ? colors.bubbleMine : colors.bubblePeer,
            borderRadius: RADIUS.lg,
            borderBottomRightRadius: mine ? 4 : RADIUS.lg,
            borderBottomLeftRadius: mine ? RADIUS.lg : 4,
            paddingHorizontal: SPACE.x3,
            paddingVertical: SPACE.x2,
            borderWidth: mine ? 0 : 1,
            borderColor: mine ? "transparent" : colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              lineHeight: 20,
              color: mine ? colors.bubbleMineText : colors.bubblePeerText,
            }}
          >
            {message.body}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              marginTop: 3,
              gap: 4,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: mine ? colors.textOnActionMuted : colors.textTertiary,
              }}
            >
              {formatClock(message.created_at)}
            </Text>
            {mine && <Ticks message={message} />}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderPending = (item: PendingMessage) => (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "flex-end",
        marginBottom: SPACE.x2,
        paddingHorizontal: SPACE.x3,
      }}
    >
      <View
        style={{
          maxWidth: "78%",
          backgroundColor: colors.primarySurfaceAlt,
          borderRadius: RADIUS.lg,
          borderBottomRightRadius: 4,
          paddingHorizontal: SPACE.x3,
          paddingVertical: SPACE.x2,
        }}
      >
        <Text style={{ fontSize: 15, lineHeight: 20, color: colors.brand }}>{item.body}</Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: 3,
            gap: 4,
          }}
        >
          <Clock size={11} color={colors.brand} />
          <Text style={{ fontSize: 10, color: colors.brand }}>Sending…</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
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
        {onBack ? (
          <IconButton icon={ArrowLeft} label="Back to inbox" onPress={onBack} />
        ) : null}
        <Avatar name={peerName} size={40} showPresence mode={peerMode} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ ...TYPE.title, color: colors.ink, fontWeight: "700" }}
          >
            {peerName}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              ...TYPE.caption,
              color: peerTyping ? colors.brand : colors.inkFaint,
              fontWeight: peerTyping ? "600" : "400",
            }}
          >
            {subtitle}
          </Text>
        </View>
        <IconButton
          icon={MoreVertical}
          label="Conversation safety options"
          onPress={() => setSafetyOpen(true)}
        />
      </View>

      {/* Blocked banner */}
      {blocked && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.x2,
            backgroundColor: colors.coralWash,
            borderBottomWidth: 1,
            borderBottomColor: colors.coral,
            paddingHorizontal: SPACE.x4,
            paddingVertical: SPACE.x3,
          }}
        >
          <Ban size={18} color={colors.coralText} />
          <Text
            style={{
              flex: 1,
              ...TYPE.caption,
              color: colors.coralText,
              lineHeight: 17,
            }}
          >
            You blocked {peerName}. Unblock to continue messaging.
          </Text>
          <Button
            label="Unblock"
            variant="danger"
            size="sm"
            onPress={() => void handleUnblock()}
            loading={actionBusy}
            disabled={actionBusy}
          />
        </View>
      )}

      {/* Requested banner */}
      {isRequested && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.x2,
            backgroundColor: colors.accentWash,
            borderBottomWidth: 1,
            borderBottomColor: colors.accent,
            paddingHorizontal: SPACE.x4,
            paddingVertical: SPACE.x3,
          }}
        >
          <ShieldAlert size={18} color={colors.accentText} />
          <Text
            style={{
              flex: 1,
              ...TYPE.caption,
              color: colors.accentText,
              lineHeight: 17,
            }}
          >
            {isRequester
              ? "Request sent. You can keep messaging — they'll see it under Requests."
              : "This is a message request. Accept to reply."}
          </Text>
          {!isRequester && (
            <Button
              label="Accept"
              size="sm"
              onPress={() => void handleAccept()}
              loading={accepting}
              disabled={accepting}
            />
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
            <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.brand} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={{ flex: 1 }}
            data={displayMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: SPACE.x3 }}
            renderItem={({ item }) => renderBubble(item)}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={
              messages.length >= 50 ? (
                <View style={{ alignItems: "center", paddingVertical: SPACE.x2 }}>
                  <Button
                    label="Load earlier messages"
                    variant="ghost"
                    size="sm"
                    onPress={() => void loadOlder()}
                  />
                </View>
              ) : undefined
            }
            ListFooterComponent={
              <>
                {pending.map((p) => (
                  <View key={p.clientMsgId}>{renderPending(p)}</View>
                ))}
              </>
            }
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingTop: SPACE.x10, paddingHorizontal: SPACE.x8 }}>
                <Card style={{ alignItems: "center", padding: SPACE.x6, maxWidth: 360 }}>
                  <Text
                    style={{
                      ...TYPE.caption,
                      color: colors.inkSoft,
                      textAlign: "center",
                      lineHeight: 20,
                    }}
                  >
                    No messages yet. Say hello to {peerName}.
                  </Text>
                </Card>
              </View>
            }
          />
        )}

        {/* Composer */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: SPACE.x2,
            paddingHorizontal: SPACE.x3,
            paddingVertical: SPACE.x3,
            backgroundColor: colors.panel,
            borderTopWidth: 1,
            borderTopColor: colors.line,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={handleDraftChange}
            editable={canReply}
            placeholder={
              canReply
                ? "Message…"
                : blocked
                ? "You blocked this user"
                : "Accept the request to reply"
            }
            placeholderTextColor={colors.textTertiary}
            multiline
            onFocus={() => setComposerFocused(true)}
            onBlur={() => setComposerFocused(false)}
            accessibilityLabel="Message"
            style={[
              {
                flex: 1,
                maxHeight: 120,
                backgroundColor: colors.inputBg,
                borderRadius: RADIUS.lg,
                borderWidth: 1,
                borderColor: composerFocused ? colors.inputBorderFocus : colors.inputBorder,
                paddingHorizontal: SPACE.x3,
                paddingVertical: SPACE.x2,
                fontSize: 15,
                lineHeight: 20,
                color: colors.ink,
                opacity: canReply ? 1 : 0.6,
                outlineStyle: "none",
              } as any,
              focusRing(colors, composerFocused),
            ]}
          />
          <Pressable
            onPress={() => void handleSend()}
            disabled={!draft.trim() || !canReply || sending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !draft.trim() || !canReply || sending }}
            onFocus={() => {}}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor:
                draft.trim() && canReply ? colors.brandSolid : colors.surfaceSunken,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {sending ? (
              <ActivityIndicator accessibilityLabel="Loading" size="small" color={colors.textOnBrandSolid} />
            ) : (
              <Send
                size={18}
                color={draft.trim() && canReply ? colors.textOnBrandSolid : colors.inkFaint}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Safety actions (report / block) */}
      <Modal
        visible={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        maxWidth={480}
        accessibilityLabel="Safety actions"
        sheetOnMobile
      >
        <View style={{ paddingVertical: SPACE.x2 }}>
          <Text
            style={{
              ...TYPE.micro,
              color: colors.inkFaint,
              paddingHorizontal: SPACE.x5,
              paddingTop: SPACE.x3,
              paddingBottom: SPACE.x2,
            }}
          >
            Safety
          </Text>
          <Pressable
            onPress={() => openReport(latestReportable)}
            disabled={!latestReportable}
            accessibilityRole="button"
            accessibilityLabel="Report message"
            onFocus={() => {}}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.x3,
              paddingHorizontal: SPACE.x5,
              minHeight: 48,
              backgroundColor: pressed ? colors.surfaceSunken : "transparent",
              opacity: latestReportable ? 1 : 0.5,
            })}
          >
            <Flag size={18} color={colors.accentText} />
            <Text style={{ ...TYPE.bodyStrong, fontWeight: "600", color: colors.ink }}>
              Report message
            </Text>
          </Pressable>
          {blocked ? (
            <Pressable
              onPress={() => void handleUnblock()}
              disabled={actionBusy}
              accessibilityRole="button"
              accessibilityLabel={`Unblock ${peerName}`}
              onFocus={() => {}}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.x3,
                paddingHorizontal: SPACE.x5,
                minHeight: 48,
                backgroundColor: pressed ? colors.surfaceSunken : "transparent",
              })}
            >
              <ShieldCheck size={18} color={colors.jadeText} />
              <Text style={{ ...TYPE.bodyStrong, fontWeight: "600", color: colors.ink }}>
                Unblock {peerName}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={confirmBlock}
              disabled={actionBusy || !peer}
              accessibilityRole="button"
              accessibilityLabel={`Block ${peerName}`}
              onFocus={() => {}}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.x3,
                paddingHorizontal: SPACE.x5,
                minHeight: 48,
                backgroundColor: pressed ? colors.surfaceSunken : "transparent",
              })}
            >
              <Ban size={18} color={colors.destructive} />
              <Text style={{ ...TYPE.bodyStrong, fontWeight: "600", color: colors.destructiveText }}>
                Block {peerName}
              </Text>
            </Pressable>
          )}
          <View style={{ height: 1, backgroundColor: colors.divider, marginTop: SPACE.x2 }} />
          <Pressable
            onPress={() => setSafetyOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onFocus={() => {}}
            style={({ pressed }) => ({
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              backgroundColor: pressed ? colors.surfaceSunken : "transparent",
            })}
          >
            <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.inkSoft }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </Modal>

      {/* Report reason */}
      <Modal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        maxWidth={520}
        accessibilityLabel="Report message"
      >
        <View style={{ padding: SPACE.x5 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: SPACE.x1,
            }}
          >
            <Text style={{ ...TYPE.h2, color: colors.ink }}>Report message</Text>
            <IconButton icon={X} label="Close" size={36} onPress={() => setReportOpen(false)} />
          </View>
          <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginBottom: SPACE.x3 }}>
            Tell a moderator why. The other person isn&apos;t told who reported them.
          </Text>

          {reportTarget && (
            <View
              style={{
                backgroundColor: colors.surfaceSunken,
                borderRadius: RADIUS.md,
                padding: SPACE.x3,
                marginBottom: SPACE.x4,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Text
                numberOfLines={3}
                style={{ ...TYPE.caption, color: colors.inkSoft, fontStyle: "italic" }}
              >
                {reportTarget.body}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.x2, marginBottom: SPACE.x4 }}>
            {REPORT_REASONS.map((reason) => {
              const active = reportReason === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => setReportReason(active ? "" : reason)}
                  accessibilityRole="button"
                  accessibilityLabel={reason}
                  accessibilityState={{ selected: active }}
                  onFocus={() => {}}
                  style={({ pressed }) => ({
                    paddingHorizontal: SPACE.x3,
                    minHeight: 36,
                    justifyContent: "center",
                    borderRadius: RADIUS.pill,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.line,
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
                      fontWeight: "600",
                      color: active ? colors.textOnBrandSolid : colors.inkSoft,
                    }}
                  >
                    {reason}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={reportReason}
            onChangeText={setReportReason}
            placeholder="Add details (optional)"
            placeholderTextColor={colors.textTertiary}
            multiline
            accessibilityLabel="Report details"
            style={{
              backgroundColor: colors.inputBg,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              paddingHorizontal: SPACE.x3,
              paddingVertical: SPACE.x2,
              fontSize: 14,
              color: colors.ink,
              minHeight: 72,
              textAlignVertical: "top",
              outlineStyle: "none",
            } as any}
          />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: SPACE.x3,
              marginTop: SPACE.x4,
            }}
          >
            <Button label="Cancel" variant="secondary" onPress={() => setReportOpen(false)} />
            <Button
              label="Submit report"
              onPress={() => void submitReport()}
              loading={actionBusy}
              disabled={actionBusy}
            />
          </View>
        </View>
      </Modal>

      {/* Block confirmation */}
      <Modal
        visible={confirmBlockOpen}
        onClose={() => {
          if (!actionBusy) setConfirmBlockOpen(false);
        }}
        maxWidth={440}
        accessibilityLabel="Block user confirmation"
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>Block user?</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            Block {peerName}? Neither of you will be able to message the other.
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
              onPress={() => setConfirmBlockOpen(false)}
              disabled={actionBusy}
            />
            <Button
              label="Block"
              variant="danger"
              onPress={() => void handleBlock()}
              loading={actionBusy}
            />
          </View>
        </View>
      </Modal>

      {/* Notice */}
      <Modal
        visible={!!notice}
        onClose={() => setNotice(null)}
        maxWidth={440}
        accessibilityLabel={notice?.title ?? "Notice"}
      >
        <View style={{ padding: SPACE.x6 }}>
          <Text style={{ ...TYPE.h2, color: colors.ink }}>{notice?.title}</Text>
          <Text style={{ ...TYPE.body, color: colors.inkSoft, marginTop: SPACE.x2 }}>
            {notice?.message}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: SPACE.x5 }}>
            <Button label="Got it" onPress={() => setNotice(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
