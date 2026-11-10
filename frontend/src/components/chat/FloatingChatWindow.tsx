/**
 * FloatingChatWindow — Facebook-style desktop floating mini-chat box.
 * Docked at the bottom-right corner of the viewport.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Image,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import {
  X,
  Minus,
  Maximize2,
  Send,
  Check,
  CheckCheck,
  Image as ImageIcon,
} from "lucide-react-native";
import Avatar from "../Avatar";
import { useAuth } from "../../contexts/AuthContext";
import { usePresence } from "../../contexts/PresenceContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useFloatingChat } from "../../contexts/FloatingChatContext";
import { useConversationRealtime } from "../../hooks/useConversationRealtime";
import { RADIUS, SPACE } from "../../lib/tokens";
import { pickImage } from "../../lib/upload";
import {
  parseMessageContent,
  formatMediaMessage,
  uploadChatImage,
} from "../../lib/chatMedia";
import ChatImageBubble from "./ChatImageBubble";
import ChatImageLightbox from "./ChatImageLightbox";

export default function FloatingChatWindow() {
  const { activeChat, isMinimized, closeChat, toggleMinimize } = useFloatingChat();
  const { colors } = useTheme();
  const { modeOf } = usePresence();
  const { session } = useAuth();
  const router = useRouter();

  if (!activeChat) return null;

  return (
    <FloatingChatInner
      peer={activeChat}
      isMinimized={isMinimized}
      onClose={closeChat}
      onToggleMinimize={toggleMinimize}
      onMaximize={() => {
        const id = activeChat.conversationId || activeChat.peerId;
        closeChat();
        router.push(`/messages/${id}`);
      }}
      colors={colors}
      userId={session?.user?.id ?? null}
      modeOf={modeOf}
    />
  );
}

function FloatingChatInner({
  peer,
  isMinimized,
  onClose,
  onToggleMinimize,
  onMaximize,
  colors,
  userId,
  modeOf,
}: {
  peer: { conversationId?: string; peerId: string; peerName?: string; avatarUrl?: string };
  isMinimized: boolean;
  onClose: () => void;
  onToggleMinimize: () => void;
  onMaximize: () => void;
  colors: any;
  userId: string | null;
  modeOf: (id: string) => string | null;
}) {
  const conversationId = peer.conversationId ?? null;
  const { messages, pending, loading, peerTyping, send, notifyTyping } =
    useConversationRealtime(conversationId);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ uri: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxData, setLightboxData] = useState<{ url: string; caption?: string } | null>(null);
  const scrollRef = useRef<any>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const peerOnline = modeOf(peer.peerId) === "online";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!isMinimized) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 60);
    }
  }, [messages.length, pending.length, isMinimized, peerTyping]);

  const handlePickPhoto = async () => {
    try {
      const res = await pickImage({ allowsEditing: false });
      if (res?.uri) {
        setAttachedImage({ uri: res.uri });
      }
    } catch (err) {
      console.error("Failed to pick image in floating chat:", err);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if ((!text && !attachedImage) || sending || uploading) return;
    setSending(true);

    let payloadBody = text;
    if (attachedImage) {
      setUploading(true);
      try {
        const key = await uploadChatImage(attachedImage.uri, conversationId);
        if (!key) {
          Alert.alert("Upload failed", "Could not upload image. Please try again.");
          setUploading(false);
          setSending(false);
          return;
        }
        payloadBody = formatMediaMessage(key, text);
      } catch (err) {
        console.error("Image upload error:", err);
        Alert.alert("Upload failed", "Could not upload image.");
        setUploading(false);
        setSending(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    setDraft("");
    setAttachedImage(null);
    try {
      await send(payloadBody);
    } catch (err) {
      console.error("Failed to send message in floating chat:", err);
    } finally {
      setSending(false);
    }
  };

  const handleDraftChange = (val: string) => {
    setDraft(val);
    notifyTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => notifyTyping(false), 2000);
  };

  // Minimized bottom bar
  if (isMinimized) {
    return (
      <View
        style={[
          styles.minimizedContainer,
          Platform.OS === "web" ? ({ position: "fixed", zIndex: 1050 } as any) : {},
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.shadowStrong,
          },
        ]}
      >
        <Pressable
          onPress={onToggleMinimize}
          style={styles.minimizedPressable}
          accessibilityLabel={`Open chat with ${peer.peerName || "peer"}`}
        >
          <View style={styles.avatarWrap}>
            <Avatar name={peer.peerName} size={28} />
            {peerOnline && <View style={[styles.presenceDotSmall, { borderColor: colors.surface }]} />}
          </View>
          <Text style={[styles.headerName, { color: colors.ink }]} numberOfLines={1}>
            {peer.peerName || "Chat"}
          </Text>
        </Pressable>

        <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close chat">
          <X size={15} color={colors.inkFaint} />
        </TouchableOpacity>
      </View>
    );
  }

  // Expanded chat window
  return (
    <View
      style={[
        styles.windowContainer,
        Platform.OS === "web" ? ({ position: "fixed", zIndex: 1050 } as any) : {},
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadowStrong,
        },
      ]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={onToggleMinimize}
          style={styles.headerInfo}
          accessibilityLabel="Toggle chat window"
        >
          <View style={styles.avatarWrap}>
            <Avatar name={peer.peerName} size={32} />
            {peerOnline && <View style={[styles.presenceDot, { borderColor: colors.surface }]} />}
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerName, { color: colors.ink }]} numberOfLines={1}>
              {peer.peerName || "Chat"}
            </Text>
            <Text style={[styles.headerStatus, { color: peerOnline ? "#10B981" : colors.inkFaint }]}>
              {peerOnline ? "Active now" : "Offline"}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerControls}>
          <TouchableOpacity
            onPress={onMaximize}
            style={styles.iconBtn}
            accessibilityLabel="Expand to full screen"
          >
            <Maximize2 size={14} color={colors.inkSoft} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onToggleMinimize}
            style={styles.iconBtn}
            accessibilityLabel="Minimize chat"
          >
            <Minus size={14} color={colors.inkSoft} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            style={styles.iconBtn}
            accessibilityLabel="Close chat"
          >
            <X size={16} color={colors.inkSoft} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Message List */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && messages.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.brand} />
          </View>
        ) : messages.length === 0 && pending.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Avatar name={peer.peerName} size={50} />
            <Text style={[styles.emptyName, { color: colors.ink }]}>
              {peer.peerName || "Friend"}
            </Text>
            <Text style={[styles.emptyPrompt, { color: colors.inkFaint }]}>
              Say hello to start the conversation!
            </Text>
          </View>
        ) : (
          <>
            {messages.map((m) => {
              const isMine = m.sender_id === userId;
              const parsed = parseMessageContent(m.body);

              if (parsed.isMedia && parsed.mediaUrl) {
                return (
                  <View
                    key={m.id}
                    style={[
                      styles.bubbleRow,
                      isMine ? styles.bubbleRowMine : styles.bubbleRowPeer,
                    ]}
                  >
                    <ChatImageBubble
                      mediaUrl={parsed.mediaUrl}
                      caption={parsed.text}
                      isMine={isMine}
                      maxWidth={230}
                      onPressImage={(url, cap) => setLightboxData({ url, caption: cap })}
                    />
                  </View>
                );
              }

              return (
                <View
                  key={m.id}
                  style={[
                    styles.bubbleRow,
                    isMine ? styles.bubbleRowMine : styles.bubbleRowPeer,
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      isMine
                        ? [styles.bubbleMine, { backgroundColor: colors.brandSolid }]
                        : [styles.bubblePeer, { backgroundColor: colors.surfaceSunken }],
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        { color: isMine ? "#FFFFFF" : colors.ink },
                      ]}
                    >
                      {m.body}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Pending local messages */}
            {pending.map((p) => {
              const parsedPending = parseMessageContent(p.body);

              if (parsedPending.isMedia && parsedPending.mediaUrl) {
                return (
                  <View key={p.clientMsgId} style={[styles.bubbleRow, styles.bubbleRowMine]}>
                    <ChatImageBubble
                      mediaUrl={parsedPending.mediaUrl}
                      caption={parsedPending.text}
                      isMine={true}
                      sending={true}
                      maxWidth={230}
                    />
                  </View>
                );
              }

              return (
                <View key={p.clientMsgId} style={[styles.bubbleRow, styles.bubbleRowMine]}>
                  <View
                    style={[
                      styles.bubble,
                      styles.bubbleMine,
                      { backgroundColor: colors.brandSolid, opacity: 0.8 },
                    ]}
                  >
                    <Text style={[styles.bubbleText, { color: "#FFFFFF" }]}>{p.body}</Text>
                  </View>
                </View>
              );
            })}

            {/* Typing indicator */}
            {peerTyping && (
              <View style={[styles.bubbleRow, styles.bubbleRowPeer]}>
                <View
                  style={[
                    styles.bubble,
                    styles.bubblePeer,
                    { backgroundColor: colors.surfaceSunken, paddingVertical: 6, paddingHorizontal: 10 },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontStyle: "italic", color: colors.inkFaint }}>
                    typing…
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Attachment Preview Strip */}
      {attachedImage && (
        <View
          style={[
            styles.attachmentStrip,
            {
              backgroundColor: colors.surfaceSunken,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View style={styles.attachmentThumbBox}>
            <Image source={{ uri: attachedImage.uri }} style={styles.attachmentThumb} />
            <TouchableOpacity
              onPress={() => setAttachedImage(null)}
              style={styles.attachmentCloseBtn}
              accessibilityLabel="Remove photo"
            >
              <X size={11} color="#FFFFFF" strokeWidth={3} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.attachmentText, { color: colors.inkFaint }]} numberOfLines={1}>
            Photo attached (will send with message)
          </Text>
        </View>
      )}

      {/* Input Composer */}
      <View
        style={[
          styles.composer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handlePickPhoto}
          disabled={uploading || sending}
          style={styles.attachBtn}
          accessibilityLabel="Attach photo"
        >
          <ImageIcon size={18} color={colors.inkSoft} />
        </TouchableOpacity>

        <TextInput
          value={draft}
          onChangeText={handleDraftChange}
          placeholder={attachedImage ? "Add a caption…" : "Aa"}
          placeholderTextColor={colors.inkFaint}
          style={[
            styles.composerInput,
            {
              backgroundColor: colors.surfaceSunken,
              color: colors.ink,
              borderColor: colors.border,
            },
          ]}
          {...(Platform.OS === "web"
            ? ({
                onKeyDown: (e: any) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                },
              } as any)
            : {})}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          accessibilityLabel="Message input"
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={(!draft.trim() && !attachedImage) || sending || uploading}
          style={[
            styles.sendBtn,
            {
              backgroundColor:
                (draft.trim() || attachedImage) && !sending && !uploading
                  ? colors.brandSolid
                  : "transparent",
              opacity: (draft.trim() || attachedImage) && !sending && !uploading ? 1 : 0.4,
            },
          ]}
          accessibilityLabel="Send message"
        >
          {uploading || sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send
              size={16}
              color={draft.trim() || attachedImage ? "#FFFFFF" : colors.inkFaint}
              strokeWidth={2.2}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Photo Lightbox */}
      <ChatImageLightbox
        visible={Boolean(lightboxData)}
        imageUrl={lightboxData?.url || null}
        caption={lightboxData?.caption}
        onClose={() => setLightboxData(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  windowContainer: {
    bottom: 0,
    right: 24,
    width: 330,
    height: 440,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 16,
  },
  minimizedContainer: {
    bottom: 0,
    right: 24,
    width: 220,
    height: 46,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 1,
    borderBottomWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  minimizedPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  avatarWrap: {
    position: "relative",
    flexShrink: 0,
  },
  presenceDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    borderWidth: 2,
  },
  presenceDotSmall: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    borderWidth: 1.5,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  headerStatus: {
    fontSize: 10.5,
    fontWeight: "500",
  },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 10,
    gap: 6,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 36,
    gap: 8,
  },
  emptyName: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  emptyPrompt: {
    fontSize: 12,
  },
  bubbleRow: {
    flexDirection: "row",
    marginVertical: 1,
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubbleRowPeer: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleMine: {
    borderBottomRightRadius: 4,
  },
  bubblePeer: {
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    gap: 6,
  },
  attachBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    gap: 8,
  },
  attachmentThumbBox: {
    position: "relative",
    width: 38,
    height: 38,
    borderRadius: 6,
    overflow: "hidden",
  },
  attachmentThumb: {
    width: "100%",
    height: "100%",
  },
  attachmentCloseBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentText: {
    flex: 1,
    fontSize: 11.5,
    fontStyle: "italic",
  },
  composerInput: {
    flex: 1,
    height: 36,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    fontSize: 13.5,
    borderWidth: 1,
    outlineStyle: "none",
  } as any,
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});

