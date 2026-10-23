import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Clock3,
  EyeOff,
  FileText,
  Flag,
  Megaphone,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ScrollText,
  Users,
  WifiOff,
} from "lucide-react-native";
import { getAdminOverview, type AdminOverview } from "../../src/lib/adminApi";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { isSuperAdminRole } from "../../src/lib/roles";
import {
  elevation,
  focusRing,
  MOTION,
  RADIUS,
  SPACE,
  TYPE,
  type ThemeTokens,
} from "../../src/lib/tokens";
import { formatCount, useCountUp } from "../../src/hooks/useCountUp";
import PageHeader from "../../src/components/admin/PageHeader";
import KpiCard from "../../src/components/admin/KpiCard";
import StatusBadge from "../../src/components/admin/StatusBadge";
import EmptyState from "../../src/components/admin/EmptyState";
import MixBar from "../../src/components/admin/MixBar";
import PulseRing from "../../src/components/admin/PulseRing";
import Reveal from "../../src/components/ui/Reveal";
import { Skeleton } from "../../src/components/ui/Skeleton";

const ACTION_LABELS: Record<string, string> = {
  "user.role_change": "Role changed",
  "user.suspend": "User suspended",
  "user.unsuspend": "User restored",
  "user.force_signout": "Sessions revoked",
  "user.delete": "User deleted",
  "content.hide": "Content hidden",
  "content.restore": "Content restored",
  "content.delete": "Content deleted",
  "report.review": "Report reviewed",
  "report.dismiss": "Report dismissed",
  "announcement.send": "Announcement sent",
  "catalog.create": "Catalog item created",
  "catalog.update": "Catalog item updated",
  "catalog.activate": "Catalog item activated",
  "catalog.deactivate": "Catalog item deactivated",
};

const ATTENTION_LABELS: Record<string, string> = {
  flagged_post: "Flagged post",
  flagged_comment: "Flagged comment",
  flagged_thesis: "Flagged thesis",
  message_report: "Reported message",
};

const ATTENTION_ICONS: Record<string, any> = {
  flagged_post: FileText,
  flagged_comment: MessageSquare,
  flagged_thesis: BookOpen,
  message_report: Flag,
};

function timeAgo(value: string) {
  const date = new Date(value).getTime();
  if (!Number.isFinite(date)) return value;
  const seconds = Math.max(0, Math.floor((Date.now() - date) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ageInfo(value: string) {
  const date = new Date(value).getTime();
  if (!Number.isFinite(date)) return { label: "unknown age", urgent: false };
  const hours = Math.max(0, Math.floor((Date.now() - date) / 3_600_000));
  if (hours < 1) return { label: "under 1h", urgent: false };
  if (hours < 24) return { label: `${hours}h`, urgent: hours >= 12 };
  return { label: `${Math.floor(hours / 24)}d`, urgent: true };
}

function clockTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function panelStyle(colors: ThemeTokens) {
  return {
    backgroundColor: colors.panel,
    borderRadius: RADIUS.xxl,
    borderWidth: 1,
    borderColor: colors.line,
    ...elevation("sm", colors),
  } as const;
}

function SectionLabel({ children, colors }: { children: ReactNode; colors: ThemeTokens }) {
  return <Text style={{ ...TYPE.micro, color: colors.inkFaint }}>{children}</Text>;
}

function PanelHeading({
  eyebrow,
  title,
  right,
  colors,
}: {
  eyebrow: string;
  title: string;
  right?: ReactNode;
  colors: ThemeTokens;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: SPACE.x3,
        flexWrap: "wrap",
      }}
    >
      <View style={{ flexShrink: 1 }}>
        <SectionLabel colors={colors}>{eyebrow}</SectionLabel>
        <Text accessibilityRole="header" style={{ ...TYPE.h2, color: colors.ink, marginTop: 3 }}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────

function HeroPulse({ data, colors }: { data: AdminOverview; colors: ThemeTokens }) {
  const router = useRouter();
  const total = data.users.total;
  const active = data.users.active_7d;
  const ratio = total ? Math.min(1, active / total) : 0;
  const displayedTotal = useCountUp(total);
  const displayedActive = useCountUp(active);
  const newJoin = data.users.new_7d;

  const segments = useMemo(
    () => [
      { label: "Students", value: data.users.students, color: colors.mixStudent },
      { label: "Faculty", value: data.users.faculty, color: colors.mixFaculty },
      { label: "Dept. admins", value: data.users.department_admins, color: colors.mixDept },
      { label: "Admins", value: data.users.admins, color: colors.mixAdmin },
      { label: "Superadmins", value: data.users.superadmins, color: colors.mixSuper },
    ],
    [colors, data.users]
  );

  return (
    <LinearGradient
      colors={[colors.heroFrom, colors.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flex: 1,
        minHeight: 316,
        borderRadius: RADIUS.xxl,
        padding: SPACE.x6,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.heroLine,
        ...elevation("md", colors),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -100,
          right: -80,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: colors.heroGlow,
          opacity: 0.24,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: -140,
          left: -60,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: colors.heroGlow,
          opacity: 0.12,
        }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: SPACE.x4,
        }}
      >
        <View style={{ flex: 1, minWidth: 220 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x2 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: colors.accentBright,
              }}
            />
            <Text style={{ ...TYPE.micro, fontSize: 9.5, color: colors.heroTextMuted }}>
              Campus pulse · live
            </Text>
          </View>

          <Text
            style={{
              ...TYPE.display,
              fontSize: 58,
              lineHeight: 62,
              color: colors.heroText,
              marginTop: SPACE.x3,
              fontVariant: ["tabular-nums"],
            }}
          >
            {formatCount(displayedTotal)}
          </Text>
          <Text style={{ ...TYPE.body, color: colors.heroTextMuted }}>
            people in the network
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.x3,
              flexWrap: "wrap",
              marginTop: SPACE.x4,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                borderRadius: RADIUS.pill,
                backgroundColor:
                  newJoin > 0 ? "rgba(143, 240, 211, 0.16)" : colors.heroLine,
                paddingHorizontal: SPACE.x3,
                paddingVertical: 5,
              }}
            >
              <ArrowUpRight
                size={12}
                color={newJoin > 0 ? colors.mixFaculty : colors.heroTextMuted}
                strokeWidth={2.6}
              />
              <Text
                style={{
                  ...TYPE.caption,
                  fontSize: 11,
                  fontWeight: "700",
                  color: newJoin > 0 ? colors.mixFaculty : colors.heroTextMuted,
                }}
              >
                {newJoin > 0 ? `+${newJoin} joined this week` : "No new joins this week"}
              </Text>
            </View>
            <Text style={{ ...TYPE.caption, color: colors.heroTextMuted }}>
              {formatCount(displayedActive)} active in the last 7 days
            </Text>
          </View>
        </View>

        <PulseRing
          value={ratio}
          size={102}
          color={colors.navAccent}
          trackColor={colors.heroLine}
          label={`${Math.round(ratio * 100)}%`}
          sublabel="Active 7d"
          onDark
        />
      </View>

      <View style={{ height: 1, backgroundColor: colors.heroLine, marginVertical: SPACE.x5 }} />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.x5 }}>
        {segments.map((segment) => (
          <View key={segment.label} style={{ minWidth: 78 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: segment.color,
                }}
              />
              <Text style={{ ...TYPE.micro, fontSize: 8, color: colors.heroTextMuted }}>
                {segment.label}
              </Text>
            </View>
            <Text
              style={{
                ...TYPE.title,
                fontSize: 17,
                color: colors.heroText,
                marginTop: 2,
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatCount(segment.value)}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: SPACE.x4 }}>
        <MixBar segments={segments} height={6} trackColor={colors.heroLine} />
      </View>

      <View
        style={{
          marginTop: SPACE.x5,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACE.x3,
          flexWrap: "wrap",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the user directory"
          onPress={() => router.push("/(admin)/users" as any)}
          style={({ pressed }) => ({
            minHeight: 34,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderRadius: RADIUS.pill,
            backgroundColor: "rgba(247, 244, 236, 0.10)",
            borderWidth: 1,
            borderColor: colors.heroLine,
            paddingHorizontal: SPACE.x3,
            paddingVertical: 6,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.heroText }}>
            View directory
          </Text>
          <ArrowUpRight size={13} color={colors.heroText} />
        </Pressable>
        <Text style={{ ...TYPE.caption, fontSize: 11, color: colors.heroTextMuted }}>
          Updated {clockTime(data.generated_at)}
        </Text>
      </View>
    </LinearGradient>
  );
}

// ─── Needs attention ───────────────────────────────────────────────────────

function AttentionRow({
  item,
  colors,
  onPress,
}: {
  item: AdminOverview["needs_attention"][number];
  colors: ThemeTokens;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const Icon = ATTENTION_ICONS[item.kind] || AlertTriangle;
  const age = ageInfo(item.created_at);
  const severe = item.kind === "message_report";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ATTENTION_LABELS[item.kind] || item.kind}: ${
        item.label || "Untitled"
      }${item.author ? ` by ${item.author}` : ""}, waiting ${age.label}`}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.x3,
          borderRadius: RADIUS.lg,
          paddingVertical: SPACE.x3,
          paddingHorizontal: SPACE.x3,
          backgroundColor: hovered ? colors.panelInset : "transparent",
          transform: [{ translateX: hovered ? 2 : 0 }],
        },
        focusRing(colors, focused),
      ]}
    >
      <View
        style={{
          width: 3,
          alignSelf: "stretch",
          minHeight: 38,
          borderRadius: 2,
          backgroundColor: severe ? colors.coral : colors.accentBright,
        }}
      />
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: RADIUS.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: severe ? colors.coralWash : colors.accentWash,
        }}
      >
        <Icon size={15} color={severe ? colors.coralText : colors.accentText} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ ...TYPE.bodyStrong, color: colors.ink }}>
          {item.label || "Untitled"}
        </Text>
        <Text numberOfLines={1} style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 1 }}>
          {ATTENTION_LABELS[item.kind] || item.kind}
          {item.author ? ` · ${item.author}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 3 }}>
        <Text
          style={{
            ...TYPE.micro,
            fontSize: 8,
            letterSpacing: 0.9,
            color: age.urgent ? colors.coralText : colors.inkFaint,
          }}
        >
          {age.urgent ? "Waiting" : "Age"}
        </Text>
        <Text
          style={{
            ...TYPE.caption,
            fontSize: 11,
            fontWeight: "700",
            color: age.urgent ? colors.coralText : colors.inkSoft,
          }}
        >
          {age.label}
        </Text>
      </View>
      <ArrowUpRight size={14} color={colors.inkFaint} />
    </Pressable>
  );
}

function AttentionPanel({ data, colors }: { data: AdminOverview; colors: ThemeTokens }) {
  const router = useRouter();
  const items = data.needs_attention.slice(0, 6);
  const total = data.needs_attention.length;

  return (
    <View style={{ ...panelStyle(colors), flex: 1, overflow: "hidden" }}>
      <View style={{ height: 4, backgroundColor: colors.accentBright }} />
      <View style={{ padding: SPACE.x5 }}>
        <PanelHeading
          eyebrow="Queue"
          title="Needs attention"
          colors={colors}
          right={
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                borderRadius: RADIUS.pill,
                backgroundColor: total > 0 ? colors.accentWash : colors.jadeWash,
                paddingHorizontal: SPACE.x3,
                paddingVertical: 4,
              }}
            >
              <Clock3
                size={11}
                color={total > 0 ? colors.accentText : colors.jadeText}
                strokeWidth={2.4}
              />
              <Text
                style={{
                  ...TYPE.caption,
                  fontSize: 11,
                  fontWeight: "700",
                  color: total > 0 ? colors.accentText : colors.jadeText,
                }}
              >
                {total > 0 ? `${total} open` : "Clear"}
              </Text>
            </View>
          }
        />

        <Text style={{ ...TYPE.caption, color: colors.inkFaint, marginTop: 4 }}>
          Oldest first · urgent items surface here.
        </Text>

        <View style={{ marginTop: SPACE.x3 }}>
          {items.length === 0 ? (
            <EmptyState
              compact
              icon={ShieldCheck}
              tone="success"
              title="The queue is clear"
              body="No reports are waiting right now. Enjoy the quiet — it is well earned."
              actionLabel="Open moderation"
              onAction={() => router.push("/(admin)/content" as any)}
            />
          ) : (
            items.map((item) => (
              <AttentionRow
                key={`${item.kind}-${item.id}`}
                item={item}
                colors={colors}
                onPress={() => router.push("/(admin)/content" as any)}
              />
            ))
          )}
        </View>

        {total > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(admin)/content" as any)}
            style={({ pressed }) => ({
              marginTop: SPACE.x3,
              minHeight: 38,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: pressed ? colors.panelInset : "transparent",
            })}
          >
            <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.inkSoft }}>
              {total > items.length ? `View all ${total} in Reports & Content` : "Open Reports & Content"}
            </Text>
            <ArrowUpRight size={13} color={colors.inkSoft} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ─── Supporting metrics ────────────────────────────────────────────────────

function LedgerStat({
  icon: Icon,
  value,
  label,
  tone,
  colors,
}: {
  icon: any;
  value: number;
  label: string;
  tone: "neutral" | "accent" | "coral" | "brand";
  colors: ThemeTokens;
}) {
  const palette =
    tone === "accent"
      ? { fg: colors.accentText, bg: colors.accentWash }
      : tone === "coral"
      ? { fg: colors.coralText, bg: colors.coralWash }
      : tone === "brand"
      ? { fg: colors.brand, bg: colors.brandWash }
      : { fg: colors.inkSoft, bg: colors.panelInset };

  return (
    <View
      style={{
        flex: 1,
        minWidth: 150,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.x3,
        paddingVertical: SPACE.x2,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: RADIUS.md,
          backgroundColor: palette.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={palette.fg} strokeWidth={2.1} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text
          style={{
            ...TYPE.title,
            fontSize: 18,
            color: colors.ink,
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatCount(value)}
        </Text>
        <Text style={{ ...TYPE.caption, fontSize: 11, color: colors.inkFaint }}>{label}</Text>
      </View>
    </View>
  );
}

function LedgerStrip({ data, colors }: { data: AdminOverview; colors: ThemeTokens }) {
  return (
    <View
      style={{
        ...panelStyle(colors),
        paddingHorizontal: SPACE.x5,
        paddingVertical: SPACE.x2,
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: SPACE.x5,
        rowGap: SPACE.x1,
      }}
    >
      <LedgerStat
        icon={EyeOff}
        value={data.content.hidden}
        label="Hidden content"
        tone="neutral"
        colors={colors}
      />
      <LedgerStat
        icon={AlertTriangle}
        value={data.content.flagged}
        label="Flagged content"
        tone="accent"
        colors={colors}
      />
      <LedgerStat
        icon={ShieldAlert}
        value={data.users.suspended}
        label="Suspended accounts"
        tone="coral"
        colors={colors}
      />
      <LedgerStat
        icon={Megaphone}
        value={data.announcements.sent_30d}
        label="Announcements · 30d"
        tone="brand"
        colors={colors}
      />
    </View>
  );
}

// ─── Bottom row ────────────────────────────────────────────────────────────

function DistributionPanel({ data, colors }: { data: AdminOverview; colors: ThemeTokens }) {
  const roles = [
    { label: "Students", value: data.users.students, color: colors.brandBright },
    { label: "Faculty", value: data.users.faculty, color: colors.jadeBright },
    { label: "Dept. admins", value: data.users.department_admins, color: colors.accentBright },
    { label: "Admins", value: data.users.admins, color: colors.coralBright },
    { label: "Superadmins", value: data.users.superadmins, color: colors.badgeThesisText },
  ];
  const content = [
    { label: "Posts", value: data.content.posts, color: colors.brandBright },
    { label: "Theses", value: data.content.theses, color: colors.jadeBright },
    { label: "Comments", value: data.content.comments, color: colors.accentBright },
  ];
  const contentTotal = content.reduce((sum, item) => sum + item.value, 0);

  return (
    <View style={{ ...panelStyle(colors), padding: SPACE.x5 }}>
      <PanelHeading eyebrow="Distribution" title="Campus makeup" colors={colors} />

      <View style={{ marginTop: SPACE.x4 }}>
        <MixBar segments={roles} height={9} />
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            columnGap: SPACE.x5,
            rowGap: SPACE.x2,
            marginTop: SPACE.x4,
          }}
        >
          {roles.map((role) => (
            <View key={role.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: role.color }}
              />
              <Text style={{ ...TYPE.caption, color: colors.inkSoft }}>{role.label}</Text>
              <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.ink }}>
                {formatCount(role.value)}
              </Text>
              <Text style={{ ...TYPE.caption, fontSize: 11, color: colors.inkFaint }}>
                {percent(role.value, data.users.total)}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: colors.line, marginVertical: SPACE.x5 }} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: SPACE.x3,
          flexWrap: "wrap",
        }}
      >
        <Text style={{ ...TYPE.title, color: colors.ink }}>Content health</Text>
        <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>
          {formatCount(contentTotal)} rows tracked
        </Text>
      </View>

      <View style={{ marginTop: SPACE.x3 }}>
        <MixBar segments={content} height={9} />
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            columnGap: SPACE.x5,
            rowGap: SPACE.x2,
            marginTop: SPACE.x4,
          }}
        >
          {content.map((item) => (
            <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: item.color }}
              />
              <Text style={{ ...TYPE.caption, color: colors.inkSoft }}>{item.label}</Text>
              <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.ink }}>
                {formatCount(item.value)}
              </Text>
            </View>
          ))}
          <StatusBadge
            label={`${formatCount(data.content.hidden)} hidden`}
            tone={data.content.hidden > 0 ? "warning" : "neutral"}
            icon={EyeOff}
          />
          <StatusBadge
            label={`${formatCount(data.content.flagged)} flagged`}
            tone={data.content.flagged > 0 ? "danger" : "success"}
            icon={data.content.flagged > 0 ? AlertTriangle : ShieldCheck}
          />
        </View>
      </View>
    </View>
  );
}

function RecentActionsPanel({ data, colors }: { data: AdminOverview; colors: ThemeTokens }) {
  const router = useRouter();
  const actions = (data.recent_actions || []).slice(0, 5);

  return (
    <View style={{ ...panelStyle(colors), padding: SPACE.x5 }}>
      <PanelHeading
        eyebrow="Audit trail"
        title="Recent actions"
        colors={colors}
        right={
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(admin)/audit" as any)}
            style={({ pressed }) => ({
              minHeight: 32,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              borderRadius: RADIUS.pill,
              backgroundColor: pressed ? colors.panelInset : colors.brandWash,
              paddingHorizontal: SPACE.x3,
              paddingVertical: 5,
            })}
          >
            <Text style={{ ...TYPE.caption, fontSize: 11, fontWeight: "700", color: colors.brand }}>
              Open audit
            </Text>
            <ArrowUpRight size={12} color={colors.brand} />
          </Pressable>
        }
      />

      <View style={{ marginTop: SPACE.x4 }}>
        {actions.length === 0 ? (
          <EmptyState
            compact
            icon={ScrollText}
            tone="brand"
            title="No governance actions yet"
            body="Role changes, suspensions, and moderation decisions will appear here."
          />
        ) : (
          actions.map((entry, index) => (
            <View
              key={entry.id}
              style={{
                flexDirection: "row",
                gap: SPACE.x3,
                paddingBottom: index === actions.length - 1 ? 0 : SPACE.x4,
              }}
            >
              <View style={{ alignItems: "center" }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: colors.brandWash,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={12} color={colors.brand} />
                </View>
                {index === actions.length - 1 ? null : (
                  <View
                    style={{
                      width: 1,
                      flex: 1,
                      backgroundColor: colors.line,
                      marginTop: 4,
                    }}
                  />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: SPACE.x2,
                  }}
                >
                  <Text style={{ ...TYPE.bodyStrong, color: colors.ink, flexShrink: 1 }}>
                    {ACTION_LABELS[entry.action] || entry.action}
                  </Text>
                  <Text style={{ ...TYPE.caption, fontSize: 11, color: colors.inkFaint }}>
                    {timeAgo(entry.created_at)}
                  </Text>
                </View>
                <Text numberOfLines={1} style={{ ...TYPE.caption, color: colors.inkSoft }}>
                  {entry.actor_username || "system"} · {entry.target_label || entry.target_type}
                </Text>
                {entry.reason ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      ...TYPE.caption,
                      fontSize: 11,
                      fontStyle: "italic",
                      color: colors.inkFaint,
                      marginTop: 2,
                    }}
                  >
                    “{entry.reason}”
                  </Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

// ─── Daily shortcuts ───────────────────────────────────────────────────────

function ShortcutsPanel({ data, colors }: { data: AdminOverview; colors: ThemeTokens }) {
  const router = useRouter();
  const openReports =
    data.reports.message_reports +
    data.reports.flagged_posts +
    data.reports.flagged_comments +
    data.reports.flagged_theses;

  const shortcuts = [
    {
      label: "Review reports",
      meta: openReports > 0 ? `${openReports} open` : "Queue clear",
      icon: Flag,
      tone: openReports > 0 ? "danger" : "success",
      path: "/(admin)/content",
    },
    {
      label: "Manage users",
      meta: `${formatCount(data.users.total)} accounts`,
      icon: Users,
      tone: "brand",
      path: "/(admin)/users",
    },
    {
      label: "Send an announcement",
      meta: `${formatCount(data.announcements.sent_30d)} sent in 30 days`,
      icon: Megaphone,
      tone: "warning",
      path: "/(admin)/announcements",
    },
  ] as const;

  return (
    <View style={{ ...panelStyle(colors), padding: SPACE.x5 }}>
      <PanelHeading eyebrow="Daily routes" title="Console shortcuts" colors={colors} />
      <View style={{ marginTop: SPACE.x4, gap: SPACE.x1 }}>
        {shortcuts.map((shortcut) => (
          <Pressable
            key={shortcut.label}
            accessibilityRole="button"
            accessibilityLabel={`${shortcut.label}. ${shortcut.meta}`}
            onPress={() => router.push(shortcut.path as any)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.x3,
              minHeight: 54,
              borderRadius: RADIUS.lg,
              paddingHorizontal: SPACE.x2,
              backgroundColor: pressed ? colors.panelInset : "transparent",
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: RADIUS.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  shortcut.tone === "danger"
                    ? colors.coralWash
                    : shortcut.tone === "success"
                    ? colors.jadeWash
                    : shortcut.tone === "warning"
                    ? colors.accentWash
                    : colors.brandWash,
              }}
            >
              <shortcut.icon
                size={16}
                color={
                  shortcut.tone === "danger"
                    ? colors.coralText
                    : shortcut.tone === "success"
                    ? colors.jadeText
                    : shortcut.tone === "warning"
                    ? colors.accentText
                    : colors.brand
                }
                strokeWidth={2.1}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...TYPE.bodyStrong, color: colors.ink }}>{shortcut.label}</Text>
              <Text style={{ ...TYPE.caption, fontSize: 11, color: colors.inkFaint }}>
                {shortcut.meta}
              </Text>
            </View>
            <ArrowUpRight size={14} color={colors.inkFaint} />
          </Pressable>
        ))}
      </View>

      <View
        style={{
          marginTop: SPACE.x4,
          borderRadius: RADIUS.lg,
          backgroundColor: colors.panelInset,
          padding: SPACE.x4,
        }}
      >
        <Text style={{ ...TYPE.micro, fontSize: 8.5, color: colors.inkFaint }}>
          Announcement reach · 30d
        </Text>
        <Text
          style={{
            ...TYPE.title,
            fontSize: 22,
            color: colors.ink,
            marginTop: 3,
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatCount(data.announcements.recipients_30d)}
        </Text>
        <Text style={{ ...TYPE.caption, color: colors.inkSoft }}>
          notifications delivered to the campus
        </Text>
      </View>
    </View>
  );
}

// ─── Loading / error ───────────────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <View style={{ gap: SPACE.x5 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.x5 }}>
        <View style={{ flex: 1.55, minWidth: 320 }}>
          <Skeleton height={316} radius={RADIUS.xxl} />
        </View>
        <View style={{ flex: 1, minWidth: 280 }}>
          <Skeleton height={316} radius={RADIUS.xxl} />
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.x4 }}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={{ flex: 1, minWidth: 220 }}>
            <Skeleton height={156} radius={RADIUS.xxl} />
          </View>
        ))}
      </View>
      <Skeleton height={78} radius={RADIUS.xxl} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.x5 }}>
        <View style={{ flex: 1.3, minWidth: 300 }}>
          <Skeleton height={260} radius={RADIUS.xxl} />
        </View>
        <View style={{ flex: 1, minWidth: 280 }}>
          <Skeleton height={260} radius={RADIUS.xxl} />
        </View>
      </View>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────

export default function AdminOverviewScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getAdminOverview());
    } catch (e: any) {
      setError(e?.message || "Could not load the overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const superadmin = isSuperAdminRole(profile?.role);
  const stackMain = width < 1320;
  const stackBottom = width < 1040;
  const horizontalPadding = width < 900 ? SPACE.x5 : width < 1400 ? SPACE.x6 : SPACE.x8;

  const flaggedTotal = data
    ? data.reports.flagged_posts + data.reports.flagged_comments + data.reports.flagged_theses
    : 0;
  const openReports = data ? flaggedTotal + data.reports.message_reports : 0;
  const contentTotal = data ? data.content.posts + data.content.theses : 0;
  const activeRatio = data && data.users.total ? data.users.active_7d / data.users.total : 0;
  const oldest = data?.needs_attention?.[0];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      contentContainerStyle={{
        paddingHorizontal: horizontalPadding,
        paddingTop: width < 900 ? SPACE.x5 : SPACE.x8,
        paddingBottom: SPACE.x16,
        alignItems: "center",
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ width: "100%", maxWidth: 1480 }}>
        <PageHeader
          eyebrow={`${superadmin ? "Superadmin" : "Administrator"} console / overview`}
          title="Overview"
          description="Campus health, moderation, and governance — read as one continuous story, not four disconnected boxes."
          meta={
            data
              ? `Snapshot generated ${new Date(data.generated_at).toLocaleString()}`
              : undefined
          }
          onRefresh={() => void load()}
          refreshing={loading}
        />

        {error && data ? (
          <View
            style={{
              marginBottom: SPACE.x5,
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.x3,
              borderRadius: RADIUS.lg,
              borderWidth: 1,
              borderColor: colors.coral,
              backgroundColor: colors.coralWash,
              padding: SPACE.x4,
            }}
          >
            <AlertTriangle size={18} color={colors.coralText} />
            <Text style={{ ...TYPE.bodyStrong, color: colors.coralText, flex: 1 }}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading the overview"
              onPress={() => void load()}
              style={({ pressed }) => ({
                minHeight: 32,
                borderRadius: RADIUS.pill,
                borderWidth: 1,
                borderColor: colors.coral,
                paddingHorizontal: SPACE.x3,
                paddingVertical: 5,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.coralText }}>
                Retry
              </Text>
            </Pressable>
          </View>
        ) : null}

        {loading && !data ? (
          <OverviewSkeleton />
        ) : data ? (
          <View style={{ gap: SPACE.x5 }}>
            <Reveal>
              <View
                style={{
                  flexDirection: stackMain ? "column" : "row",
                  alignItems: "stretch",
                  gap: SPACE.x5,
                }}
              >
                <View
                  style={{
                    flex: stackMain ? undefined : 1.55,
                    width: stackMain ? "100%" : undefined,
                    minWidth: 0,
                  }}
                >
                  <HeroPulse data={data} colors={colors} />
                </View>
                <View
                  style={{
                    flex: stackMain ? undefined : 1,
                    width: stackMain ? "100%" : undefined,
                    minWidth: 0,
                  }}
                >
                  <AttentionPanel data={data} colors={colors} />
                </View>
              </View>
            </Reveal>

            <Reveal delay={MOTION.stagger}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.x4 }}>
                <KpiCard
                  label="Content library"
                  value={contentTotal}
                  detail={`${formatCount(data.content.posts)} posts · ${formatCount(
                    data.content.theses
                  )} theses`}
                  icon={FileText}
                  tone="brand"
                  onPress={() => router.push("/(admin)/content" as any)}
                  footer={
                    <View style={{ gap: 6 }}>
                      <MixBar
                        segments={[
                          { label: "Posts", value: data.content.posts, color: colors.brandBright },
                          { label: "Theses", value: data.content.theses, color: colors.jadeBright },
                        ]}
                        height={5}
                      />
                      <Text style={{ ...TYPE.caption, fontSize: 11, color: colors.inkFaint }}>
                        {formatCount(data.content.comments)} comments live alongside
                      </Text>
                    </View>
                  }
                />
                <KpiCard
                  label="Open reports"
                  value={openReports}
                  detail={`${formatCount(data.reports.message_reports)} messages · ${formatCount(
                    flaggedTotal
                  )} flagged`}
                  icon={Flag}
                  tone="coral"
                  onPress={() => router.push("/(admin)/content" as any)}
                  footer={
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: oldest ? colors.coral : colors.jade,
                        }}
                      />
                      <Text
                        style={{
                          ...TYPE.caption,
                          fontSize: 11,
                          color: oldest ? colors.coralText : colors.jadeText,
                        }}
                      >
                        {oldest ? `Oldest waiting ${ageInfo(oldest.created_at).label}` : "Queue clear"}
                      </Text>
                    </View>
                  }
                />
                <KpiCard
                  label="Active this week"
                  value={data.users.active_7d}
                  detail={`${percent(data.users.active_7d, data.users.total)}% of accounts checked in`}
                  icon={Activity}
                  tone="jade"
                  delta={
                    data.users.new_7d > 0
                      ? { value: data.users.new_7d, label: `+${data.users.new_7d} joined` }
                      : undefined
                  }
                  footer={
                    <View style={{ gap: 6 }}>
                      <View
                        style={{
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: colors.panelInset,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            width: `${Math.round(activeRatio * 100)}%`,
                            height: 5,
                            borderRadius: 3,
                            backgroundColor: colors.jade,
                          }}
                        />
                      </View>
                      <Text style={{ ...TYPE.caption, fontSize: 11, color: colors.inkFaint }}>
                        {formatCount(data.users.new_7d)} new accounts in the last 7 days
                      </Text>
                    </View>
                  }
                />
              </View>
            </Reveal>

            <Reveal delay={MOTION.stagger * 2}>
              <LedgerStrip data={data} colors={colors} />
            </Reveal>

            <Reveal delay={MOTION.stagger * 3}>
              <View
                style={{
                  flexDirection: stackBottom ? "column" : "row",
                  alignItems: "stretch",
                  gap: SPACE.x5,
                }}
              >
                <View
                  style={{
                    flex: stackBottom ? undefined : 1.25,
                    width: stackBottom ? "100%" : undefined,
                    minWidth: 0,
                  }}
                >
                  <DistributionPanel data={data} colors={colors} />
                </View>
                <View
                  style={{
                    flex: stackBottom ? undefined : 1,
                    width: stackBottom ? "100%" : undefined,
                    minWidth: 0,
                  }}
                >
                  {superadmin ? (
                    <RecentActionsPanel data={data} colors={colors} />
                  ) : (
                    <ShortcutsPanel data={data} colors={colors} />
                  )}
                </View>
              </View>
            </Reveal>
          </View>
        ) : (
          <View style={{ ...panelStyle(colors), marginTop: SPACE.x2 }}>
            <EmptyState
              icon={WifiOff}
              tone="danger"
              title="Signal lost"
              body={
                error ||
                "The overview could not reach the campus API. Check the connection and try again."
              }
              actionLabel="Try again"
              onAction={() => void load()}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
