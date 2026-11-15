import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import {
  Send,
  Trash2,
  CornerDownRight,
  MessageCircle,
} from "lucide-react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { apiFetch, deleteComment } from "../lib/api";
import Avatar from "./Avatar";

interface CommentItem {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: {
    id: string;
    full_name?: string;
    username?: string;
    avatar_url?: string;
    department_name?: string;
  };
}

interface InlineCommentsDrawerProps {
  postId: string | number;
  initialCount: number;
  onCountChange?: (newCount: number) => void;
}

export default function InlineCommentsDrawer({
  postId,
  initialCount,
  onCountChange,
}: InlineCommentsDrawerProps) {
  const { profile, isGuest } = useAuth();
  const { colors, isDark } = useTheme();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load comments
  useEffect(() => {
    let cancelled = false;

    const loadComments = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/posts/${postId}/comments`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setComments(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load inline comments:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  const handleSubmit = async () => {
    const text = commentText.trim();
    if (!text || submitting) return;

    if (!profile?.id || isGuest) {
      Alert.alert(
        "Sign In Required",
        "Please sign in with your student or faculty account to comment."
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiFetch(`/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });

      if (res.ok) {
        const newComment = await res.json();
        const formattedComment: CommentItem = {
          id: newComment.id || String(Date.now()),
          user_id: profile.id,
          content: text,
          created_at: newComment.created_at || new Date().toISOString(),
          user: {
            id: profile.id,
            full_name: profile.full_name || undefined,
            username: profile.username || undefined,
            avatar_url: profile.avatar_url || undefined,
            department_name: profile.department_name || undefined,
          },
        };

        const updated = [...comments, formattedComment];
        setComments(updated);
        setCommentText("");
        onCountChange?.(updated.length);
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error || "Failed to post comment");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (commentId: string) => {
    Alert.alert("Delete Comment", "Are you sure you want to delete this comment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setDeletingId(commentId);
            await deleteComment(postId, commentId);
            const updated = comments.filter((c) => c.id !== commentId);
            setComments(updated);
            onCountChange?.(updated.length);
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to delete comment");
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const formatTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d`;
      return new Date(isoString).toLocaleDateString();
    } catch {
      return "";
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? colors.surfaceSunken : "#F9FAFB",
          borderTopColor: colors.border,
        },
      ]}
    >
      {/* 1. Comment Input Composer */}
      <View style={styles.composerRow}>
        <Avatar
          name={profile?.full_name ?? profile?.username}
          size={34}
        />
        <View
          style={[
            styles.inputPill,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TextInput
            placeholder={`Write a comment as ${
              profile?.full_name?.split(" ")[0] || profile?.username || "Guest"
            }…`}
            placeholderTextColor={colors.textTertiary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            style={[styles.input, { color: colors.textPrimary }]}
            onSubmitEditing={handleSubmit}
          />
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!commentText.trim() || submitting}
            style={[
              styles.sendBtn,
              {
                backgroundColor: commentText.trim() && !submitting ? colors.action : "transparent",
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send comment"
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.action} />
            ) : (
              <Send
                size={16}
                color={commentText.trim() ? "#FFFFFF" : colors.textTertiary}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Loading State */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.action} />
        </View>
      ) : comments.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyContainer}>
          <MessageCircle size={20} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            No comments yet. Be the first to comment!
          </Text>
        </View>
      ) : (
        /* 3. Comment List */
        <View style={styles.commentsList}>
          {comments.map((comment) => {
            const authorName = comment.user?.full_name || comment.user?.username || "Unknown";
            const isOwner = profile?.id === comment.user_id;

            return (
              <View key={comment.id} style={styles.commentItem}>
                <Avatar name={authorName} size={32} />
                <View style={styles.commentRight}>
                  {/* Bubble */}
                  <View
                    style={[
                      styles.commentBubble,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.commentHeader}>
                      <Text style={[styles.authorName, { color: colors.textPrimary }]}>
                        {authorName}
                      </Text>
                      {comment.user?.department_name && (
                        <Text style={[styles.departmentText, { color: colors.textTertiary }]}>
                          · {comment.user.department_name}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.commentBody, { color: colors.textPrimary }]}>
                      {comment.content}
                    </Text>
                  </View>

                  {/* Actions / Meta */}
                  <View style={styles.commentMeta}>
                    <Text style={[styles.metaTime, { color: colors.textTertiary }]}>
                      {formatTime(comment.created_at)}
                    </Text>

                    {isOwner && (
                      <TouchableOpacity
                        onPress={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        style={styles.deleteBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Delete comment"
                      >
                        {deletingId === comment.id ? (
                          <ActivityIndicator size="small" color={colors.destructive} />
                        ) : (
                          <Trash2 size={13} color={colors.destructive} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  inputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
    minHeight: 38,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 4,
    maxHeight: 100,
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  emptyText: {
    fontSize: 12.5,
    fontWeight: "500",
  },
  commentsList: {
    gap: 12,
    marginTop: 6,
  },
  commentItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  commentRight: {
    flex: 1,
  },
  commentBubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "flex-start",
    maxWidth: "92%",
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "700",
  },
  departmentText: {
    fontSize: 11,
  },
  commentBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  commentMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 3,
    paddingLeft: 4,
  },
  metaTime: {
    fontSize: 11,
  },
  deleteBtn: {
    padding: 2,
  },
});

