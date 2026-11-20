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
  { key: "thesis", label: "Thesis / Research" },
];

const THESIS_CATEGORIES = [
  "Thesis",
  "Capstone",
  "Dissertation",
  "Research Paper",
  "Case Study",
];

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
              ? "Thesis / Research paper title"
              : repositoryType === "capstone"
              ? "Capstone / Final output title"
              : "Project / Creative work title"
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

      {/* Tools, Skills, or Materials used (Generalized across all courses) */}
      {repositoryType !== "thesis" && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Tools, Materials, or Skills (optional)
          </Text>
          <TextInput
            placeholder="e.g. AutoCAD, SPSS, React, Figma, Oil on Canvas, Financial Modeling"
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

      {/* Resource / Portfolio Link (Optional for Project & Capstone) */}
      {repositoryType !== "thesis" && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Project or Resource Link (optional)
          </Text>
          <TextInput
            placeholder="https://... (Portfolio, Google Drive, Behance, GitHub, Canva)"
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

      {/* Live Demo or Presentation URL (Optional) */}
      {repositoryType !== "thesis" && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Live Demo or Presentation Link (optional)
          </Text>
          <TextInput
            placeholder="https://... (Website, Demo, Slides, Video)"
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

      {/* Category / Department / Field for Capstone */}
      {repositoryType === "capstone" && (
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Program / Field</Text>
          <TextInput
            placeholder="e.g. Architecture, Business, Nursing, IT, Education, Fine Arts"
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
