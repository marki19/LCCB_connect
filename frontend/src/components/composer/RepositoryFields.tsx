import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import type { RepositoryType } from "../../types";

export type RepositoryFieldValues = {
  title: string;
  technologies: string;
  githubUrl: string;
  liveUrl: string;
  category: string;
};

type Props = {
  repositoryType: RepositoryType;
  values: RepositoryFieldValues;
  onChange: (fields: Partial<RepositoryFieldValues>) => void;
  onTypeChange: (type: RepositoryType) => void;
};

const SUBTYPES: { key: RepositoryType; label: string }[] = [
  { key: "project", label: "Project" },
  { key: "capstone", label: "Capstone" },
  { key: "thesis", label: "Thesis" },
];

const THESIS_CATEGORIES = ["Capstone", "Dissertation"];

export default function RepositoryFields({
  repositoryType,
  values,
  onChange,
  onTypeChange,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Subtype selector pills */}
      <View style={styles.pillRow}>
        {SUBTYPES.map((sub) => {
          const active = repositoryType === sub.key;
          return (
            <TouchableOpacity
              key={sub.key}
              onPress={() => onTypeChange(sub.key)}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? colors.action : colors.surfaceSunken,
                  borderColor: active ? colors.action : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: active ? "#FFFFFF" : colors.textSecondary },
                ]}
              >
                {sub.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Title */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Title *</Text>
        <TextInput
          placeholder={
            repositoryType === "thesis"
              ? "Thesis / Dissertation title"
              : repositoryType === "capstone"
              ? "Capstone title"
              : "Project title"
          }
          placeholderTextColor={colors.textTertiary}
          value={values.title}
          onChangeText={(title) => onChange({ title })}
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceSunken,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
      </View>

      {/* Tech Stack (Project & Capstone) */}
      {repositoryType !== "thesis" && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Technologies (comma-separated)
          </Text>
          <TextInput
            placeholder="React Native, Node.js, PostgreSQL"
            placeholderTextColor={colors.textTertiary}
            value={values.technologies}
            onChangeText={(technologies) => onChange({ technologies })}
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
        </View>
      )}

      {/* Repository / Source Code URL (Project) */}
      {repositoryType === "project" && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Repository URL
          </Text>
          <TextInput
            placeholder="https://github.com/username/repository"
            placeholderTextColor={colors.textTertiary}
            value={values.githubUrl}
            onChangeText={(githubUrl) => onChange({ githubUrl })}
            autoCapitalize="none"
            keyboardType="url"
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
        </View>
      )}

      {/* Live Demo URL (Project) */}
      {repositoryType === "project" && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Live Demo URL
          </Text>
          <TextInput
            placeholder="https://my-app.vercel.app"
            placeholderTextColor={colors.textTertiary}
            value={values.liveUrl}
            onChangeText={(liveUrl) => onChange({ liveUrl })}
            autoCapitalize="none"
            keyboardType="url"
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
        </View>
      )}

      {/* Category selector for Thesis */}
      {repositoryType === "thesis" && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
          <View style={styles.categoryRow}>
            {THESIS_CATEGORIES.map((cat) => {
              const active = values.category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => onChange({ category: cat })}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: active ? colors.actionSurface : colors.surfaceSunken,
                      borderColor: active ? colors.action : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: active ? "700" : "500",
                      color: active ? colors.action : colors.textSecondary,
                    }}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Category for Capstone (free-text or department area) */}
      {repositoryType === "capstone" && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Category / Field</Text>
          <TextInput
            placeholder="e.g. Information Technology, Computer Science"
            placeholderTextColor={colors.textTertiary}
            value={values.category}
            onChangeText={(category) => onChange({ category })}
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  fieldGroup: {
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
});
