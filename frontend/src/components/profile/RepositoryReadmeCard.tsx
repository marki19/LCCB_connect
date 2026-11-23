import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BookOpen, FileText, Tag, Calendar } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";
import type { Post } from "../../types";

interface RepositoryReadmeCardProps {
  post: Post | any;
}

export default function RepositoryReadmeCard({ post }: RepositoryReadmeCardProps) {
  const { colors } = useTheme();

  const title = post.title || "Project Overview";
  const abstract = post.description || post.content || post.abstract || "";
  const tools: string[] = Array.isArray(post.tags) ? post.tags : [];
  const program = post.repository_category || post.category || "Academic Project";
  const repoType = post.repository_type || (post.type === "thesis" ? "thesis" : "project");

  const formattedDate = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : post.created_at
    ? new Date(post.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* GitHub-style File Header Bar */}
      <View
        style={[
          styles.fileBar,
          { backgroundColor: colors.surfaceSunken, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.fileBarLeft}>
          <BookOpen size={16} color={colors.inkSoft} style={{ marginRight: 8 }} />
          <Text style={[styles.fileName, { color: colors.ink }]}>README.md</Text>
        </View>
        <Text style={[styles.fileBarBadge, { color: colors.inkFaint }]}>
          {repoType.toUpperCase()}
        </Text>
      </View>

      {/* Main README Body */}
      <View style={styles.contentBody}>
        {/* Title & Metadata */}
        <Text style={[styles.projectTitle, { color: colors.ink }]}>{title}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <FileText size={13} color={colors.inkFaint} />
            <Text style={[styles.metaText, { color: colors.inkSoft }]}>{program}</Text>
          </View>
          {formattedDate && (
            <View style={styles.metaItem}>
              <Calendar size={13} color={colors.inkFaint} />
              <Text style={[styles.metaText, { color: colors.inkSoft }]}>
                Published on {formattedDate}
              </Text>
            </View>
          )}
        </View>

        {/* Abstract / Description */}
        {abstract ? (
          <View style={[styles.abstractWrap, { borderLeftColor: colors.brand }]}>
            <Text style={[styles.abstractHeading, { color: colors.inkSoft }]}>
              ABSTRACT & SUMMARY
            </Text>
            <Text style={[styles.abstractBody, { color: colors.ink }]}>
              {abstract}
            </Text>
          </View>
        ) : null}

        {/* Tools, Skills, and Materials Tags */}
        {tools.length > 0 && (
          <View style={styles.toolsSection}>
            <View style={styles.toolsHeader}>
              <Tag size={13} color={colors.inkFaint} style={{ marginRight: 6 }} />
              <Text style={[styles.toolsLabel, { color: colors.inkSoft }]}>
                Tools, Skills & Materials
              </Text>
            </View>
            <View style={styles.tagsContainer}>
              {tools.map((tag, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.tagChip,
                    { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.tagText, { color: colors.ink }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: SPACE.x4,
  },
  fileBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.x4,
    paddingVertical: SPACE.x2 + 2,
    borderBottomWidth: 1,
  },
  fileBarLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  fileName: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  fileBarBadge: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  contentBody: {
    padding: SPACE.x5,
  },
  projectTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginBottom: SPACE.x2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACE.x3,
    marginBottom: SPACE.x4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "500",
  },
  abstractWrap: {
    borderLeftWidth: 3,
    paddingLeft: SPACE.x3,
    marginVertical: SPACE.x3,
  },
  abstractHeading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  abstractBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  toolsSection: {
    marginTop: SPACE.x4,
    paddingTop: SPACE.x3,
  },
  toolsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACE.x2,
  },
  toolsLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.x2,
  },
  tagChip: {
    paddingHorizontal: SPACE.x3,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
