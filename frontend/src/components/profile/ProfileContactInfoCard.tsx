import React from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { AtSign, Mail, Globe, Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import ProfileCard from "./ProfileCard";
import { UserProfileData } from "../../lib/api";
import { useTheme } from "../../contexts/ThemeContext";
import { RADIUS, SPACE } from "../../lib/tokens";

interface ProfileContactInfoCardProps {
  userData: UserProfileData;
  isSelf?: boolean;
}

function normalizeWebUrl(val: string, baseUrl: string): string {
  const trimmed = val.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const clean = trimmed.replace(/^@/, "");
  return `${baseUrl}${clean}`;
}

function displaySocialHandle(val: string, domain: string): string {
  const trimmed = val.trim();
  if (trimmed.includes(domain)) {
    return trimmed.replace(/^https?:\/\/(www\.)?/i, "");
  }
  const clean = trimmed.replace(/^@/, "");
  return `${domain}/${clean}`;
}

export default function ProfileContactInfoCard({
  userData,
  isSelf,
}: ProfileContactInfoCardProps) {
  const router = useRouter();
  const { colors } = useTheme();

  const handleOpenLink = (url: string) => {
    void Linking.openURL(url);
  };

  const hasContactEmail = Boolean(userData.contact_email?.trim());
  const hasFacebook = Boolean(userData.facebook_url?.trim());
  const hasInstagram = Boolean(userData.instagram_url?.trim());
  const hasTwitter = Boolean(userData.twitter_url?.trim());
  const hasSchoolEmail = Boolean(userData.email?.trim());
  const hasUsername = Boolean(userData.username?.trim());

  const hasAnySocial = hasContactEmail || hasFacebook || hasInstagram || hasTwitter;
  const hasAnyContact = hasAnySocial || hasSchoolEmail || hasUsername;

  return (
    <ProfileCard
      title="Contact info"
      actionLabel={isSelf ? "Edit" : undefined}
      onAction={isSelf ? () => router.push("/edit-profile") : undefined}
    >
      <View style={styles.container}>
        {/* Username Handle */}
        {hasUsername ? (
          <View style={styles.detailRow}>
            <AtSign size={18} color={colors.inkFaint} />
            <Text style={[styles.detailText, { color: colors.ink }]}>
              @{userData.username}
            </Text>
          </View>
        ) : null}

        {/* Contact Email (personal/custom) */}
        {hasContactEmail ? (
          <Pressable
            onPress={() => handleOpenLink(`mailto:${userData.contact_email?.trim()}`)}
            accessibilityRole="link"
            accessibilityLabel="Send email"
            style={({ pressed, hovered }: any) => [
              styles.detailRow,
              {
                cursor: "pointer",
                opacity: pressed ? 0.7 : hovered ? 0.85 : 1,
              },
            ]}
          >
            <Mail size={18} color={colors.inkFaint} />
            <Text style={[styles.detailText, { color: colors.brand, fontWeight: "500" }]} numberOfLines={1}>
              {userData.contact_email?.trim()}
            </Text>
          </Pressable>
        ) : null}

        {/* Facebook Link */}
        {hasFacebook ? (
          <Pressable
            onPress={() =>
              handleOpenLink(normalizeWebUrl(userData.facebook_url!.trim(), "https://facebook.com/"))
            }
            accessibilityRole="link"
            accessibilityLabel="Open Facebook profile"
            style={({ pressed, hovered }: any) => [
              styles.detailRow,
              {
                cursor: "pointer",
                opacity: pressed ? 0.7 : hovered ? 0.85 : 1,
              },
            ]}
          >
            <Globe size={18} color={colors.inkFaint} />
            <Text style={[styles.detailText, { color: colors.brand, fontWeight: "600" }]} numberOfLines={1}>
              {displaySocialHandle(userData.facebook_url!.trim(), "facebook.com")}
            </Text>
          </Pressable>
        ) : null}

        {/* Instagram Link */}
        {hasInstagram ? (
          <Pressable
            onPress={() =>
              handleOpenLink(normalizeWebUrl(userData.instagram_url!.trim(), "https://instagram.com/"))
            }
            accessibilityRole="link"
            accessibilityLabel="Open Instagram profile"
            style={({ pressed, hovered }: any) => [
              styles.detailRow,
              {
                cursor: "pointer",
                opacity: pressed ? 0.7 : hovered ? 0.85 : 1,
              },
            ]}
          >
            <Globe size={18} color={colors.inkFaint} />
            <Text style={[styles.detailText, { color: colors.brand, fontWeight: "600" }]} numberOfLines={1}>
              {displaySocialHandle(userData.instagram_url!.trim(), "instagram.com")}
            </Text>
          </Pressable>
        ) : null}

        {/* Twitter / X Link */}
        {hasTwitter ? (
          <Pressable
            onPress={() =>
              handleOpenLink(normalizeWebUrl(userData.twitter_url!.trim(), "https://x.com/"))
            }
            accessibilityRole="link"
            accessibilityLabel="Open Twitter or X profile"
            style={({ pressed, hovered }: any) => [
              styles.detailRow,
              {
                cursor: "pointer",
                opacity: pressed ? 0.7 : hovered ? 0.85 : 1,
              },
            ]}
          >
            <Globe size={18} color={colors.inkFaint} />
            <Text style={[styles.detailText, { color: colors.brand, fontWeight: "600" }]} numberOfLines={1}>
              {displaySocialHandle(userData.twitter_url!.trim(), "x.com")}
            </Text>
          </Pressable>
        ) : null}

        {/* School Google Workspace Email (fallback if contact email is different or absent) */}
        {hasSchoolEmail && userData.email !== userData.contact_email ? (
          <View style={styles.detailRow}>
            <Mail size={18} color={colors.inkFaint} />
            <Text style={[styles.detailText, { color: colors.inkSoft }]} numberOfLines={1}>
              {userData.email}
            </Text>
          </View>
        ) : null}

        {/* Empty state & prompt */}
        {!hasAnySocial && (
          isSelf ? (
            <Pressable
              onPress={() => router.push("/edit-profile")}
              accessibilityRole="button"
              accessibilityLabel="Add contact info"
              style={({ pressed, hovered }: any) => [
                styles.addPromptBtn,
                {
                  backgroundColor: colors.surfaceSunken,
                  borderColor: colors.border,
                  cursor: "pointer",
                  opacity: pressed ? 0.75 : hovered ? 0.9 : 1,
                },
              ]}
            >
              <Plus size={15} color={colors.brand} />
              <Text style={[styles.addPromptText, { color: colors.brand }]}>
                Add contact & social links
              </Text>
            </Pressable>
          ) : !hasAnyContact ? (
            <Text style={[styles.detailText, { color: colors.inkFaint, fontStyle: "italic" }]}>
              No contact info provided.
            </Text>
          ) : null
        )}
      </View>
    </ProfileCard>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACE.x3,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.x3,
  },
  detailText: {
    fontSize: 14,
    fontWeight: "500",
  },
  addPromptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.x2,
    paddingVertical: SPACE.x2,
    paddingHorizontal: SPACE.x3,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: SPACE.x1,
  },
  addPromptText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
