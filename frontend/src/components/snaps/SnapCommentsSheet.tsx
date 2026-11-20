import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CornerDownRight, Send, X } from "lucide-react-native";
import Avatar from "../Avatar";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { addSnapComment, getSnapComments, type SnapComment } from "../../lib/snaps";
import { RADIUS, SPACE } from "../../lib/tokens";

interface SnapCommentsSheetProps {
  snapId: string;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

/**
 * Comments and one-level replies for the snap currently on screen.
 *
 * Mounted only while open, so every open starts from a clean draft and a fresh
 * fetch. Rendered as an overlay inside the viewer rather than a nested modal:
 * the viewer is already a modal, and stacking native modals is unreliable on
 * iOS. Reads are open to any active account; writes need a verified one, which
 * the server enforces and this component mirrors by hiding the composer for
 * guests.
 */
export default function SnapCommentsSheet({
  snapId,
  onClose,
  onCountChange,
}: SnapCommentsSheetProps) {
  const { isGuest } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [comments, setComments] = useState<SnapComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<SnapComment | null>(null);

  useEffect(() => {
    let cancelled = false;

    getSnapComments(snapId)
      .then((rows) => {
        if (cancelled) return;
        setComments(rows);
        onCountChange?.(rows.length);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapId]);

  const roots = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const repliesByParent = useMemo(() => {
    const map = new Map<string, SnapComment[]>();
    for (const comment of comments) {
      if (!comment.parent_id) continue;
      const list = map.get(comment.parent_id) ?? [];
      list.push(comment);
      map.set(comment.parent_id, list);
    }
    return map;
  }, [comments]);

  const handleSubmit = useCallback(async () => {
    const body = draft.trim();
    if (!body || submitting) return;

    setSubmitting(true);
    try {
      const created = await addSnapComment(snapId, body, replyTo?.id ?? null);
      const next = [...comments, created];
      setComments(next);
      onCountChange?.(next.length);
      setDraft("");
      setReplyTo(null);
    } catch (err: any) {
      showToast({ message: err?.message || "Couldn't post that comment", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }, [comments, draft, onCountChange, replyTo, showToast, snapId, submitting]);

  const renderRow = (comment: SnapComment, isReply: boolean) => {
    const name = comment.full_name || comment.username || "Someone";
    return (
      <View
        key={comment.id}
        style={[styles.row, isReply && { paddingLeft: SPACE.x8 }]}
      >
        <Avatar
          name={name}
          avatarUrl={comment.avatar_url}
          size={isReply ? 26 : 32}
        />
        <View style={styles.rowBody}>
          <Text style={[styles.author, { color: colors.ink }]}>{name}</Text>
          <Text style={[styles.body, { color: colors.inkSoft }]}>{comment.body}</Text>
          {!isReply && !isGuest && (
            <Pressable
              onPress={() => setReplyTo(comment)}
              accessibilityRole="button"
              accessibilityLabel={`Reply to ${name}`}
              hitSlop={6}
            >
              <Text style={[styles.replyLink, { color: colors.brand }]}>Reply</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.overlay}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close comments"
      />

      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.ink }]}>Comments</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close comments"
            hitSlop={8}
            style={({ pressed }: any) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <X size={18} color={colors.ink} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={colors.brand} />
          </View>
        ) : roots.length === 0 ? (
          <View style={styles.center}>
            <Text style={[styles.empty, { color: colors.inkFaint }]}>No comments yet</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={{ gap: SPACE.x3 }}
            keyboardShouldPersistTaps="handled"
          >
            {roots.map((root) => (
              <View key={root.id} style={{ gap: SPACE.x2 }}>
                {renderRow(root, false)}
                {(repliesByParent.get(root.id) ?? []).map((reply) =>
                  renderRow(reply, true)
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {isGuest ? (
          <Text style={[styles.guestNote, { color: colors.inkFaint }]}>
            Guest accounts can read comments but not post them.
          </Text>
        ) : (
          <View style={[styles.composer, { borderTopColor: colors.border }]}>
            {replyTo && (
              <View style={styles.replyPill}>
                <CornerDownRight size={13} color={colors.inkSoft} />
                <Text numberOfLines={1} style={[styles.replyPillText, { color: colors.inkSoft }]}>
                  Replying to {replyTo.full_name || replyTo.username}
                </Text>
                <Pressable
                  onPress={() => setReplyTo(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel reply"
                  hitSlop={6}
                >
                  <X size={13} color={colors.inkSoft} />
                </Pressable>
              </View>
            )}
            <View style={styles.composerRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
                placeholderTextColor={colors.inkFaint}
                maxLength={500}
                multiline
                style={[
                  styles.input,
                  {
                    color: colors.ink,
                    backgroundColor: colors.surfaceSunken,
                    borderColor: colors.border,
                  },
                ]}
                onSubmitEditing={handleSubmit}
              />
              <Pressable
                onPress={handleSubmit}
                disabled={!draft.trim() || submitting}
                accessibilityRole="button"
                accessibilityLabel="Send comment"
                style={({ pressed }: any) => [
                  styles.sendBtn,
                  {
                    backgroundColor: colors.brandSolid,
                    opacity: !draft.trim() || submitting ? 0.4 : pressed ? 0.75 : 1,
                  },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Send size={16} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    zIndex: 40,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    maxHeight: "70%",
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    paddingBottom: SPACE.x4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x3,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    paddingHorizontal: SPACE.x4,
  },
  center: {
    paddingVertical: SPACE.x8,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    gap: SPACE.x3,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  author: {
    fontSize: 13,
    fontWeight: "700",
  },
  body: {
    fontSize: 14,
    lineHeight: 19,
  },
  replyLink: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  composer: {
    borderTopWidth: 1,
    marginTop: SPACE.x3,
    paddingHorizontal: SPACE.x4,
    paddingTop: SPACE.x3,
    gap: SPACE.x2,
  },
  replyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  replyPillText: {
    flex: 1,
    fontSize: 12,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACE.x2,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.x3,
    paddingVertical: SPACE.x2,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  guestNote: {
    fontSize: 12,
    textAlign: "center",
    paddingTop: SPACE.x3,
  },
});
