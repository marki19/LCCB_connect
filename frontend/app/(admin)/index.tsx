import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock3,
  EyeOff,
  FileText,
  Flag,
  Megaphone,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Users,
  WifiOff,
} from "lucide-react-native";
import { getAdminOverview, type AdminOverview } from "../../src/lib/adminApi";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { isSuperAdminRole } from "../../src/lib/roles";
import {
  focusRing,
  RADIUS,
  SPACE,
  type ThemeTokens,
} from "../../src/lib/tokens";
import { formatCount } from "../../src/hooks/useCountUp";
import PageHeader from "../../src/components/admin/PageHeader";
import KpiCard from "../../src/components/admin/KpiCard";
import StatusBadge from "../../src/components/admin/StatusBadge";
import EmptyState from "../../src/components/admin/EmptyState";
import MixBar from "../../src/components/admin/MixBar";
import { CONSOLE_TEXT, consoleCard } from "../../src/components/admin/consoleTheme";
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
  if (typeof value !== "string") return "unknown";
  const date = new Date(value).getTime();
  if (!Number.isFinite(date)) return "unknown";
  const seconds = Math.max(0, Math.floor((Date.now() - date) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

function ageInfo(value: string) {
  const date = new Date(value).getTime();
  if (!Number.isFinite(date)) return { label: "unknown", urgent: false };
  const hours = Math.max(0, Math.floor((Date.now() - date) / 3_600_000));
  if (hours < 1) return { label: "under 1 h", urgent: false };
  if (hours < 24) return { label: `${hours} h`, urgent: hours >= 12 };
  return { label: `${Math.floor(hours / 24)} d`, urgent: true };
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function SectionLabel({ children, colors }: { children: ReactNode; colors: ThemeTokens }) {
  return (
    <Text style={{ ...CONSOLE_TEXT.eyebrow, fontSize: 10.5, color: colors.inkFaint }}>
      {children}
    </Text>
  );
}

function Panel({
  eyebrow,
  title,
  right,
  children,
  style,
  colors,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  style?: any;
  colors: ThemeTokens;
}) {
  return (
    <View style={[{ ...consoleCard(colors), padding: SPACE.x5 }, style]}>
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
          {eyebrow ? <SectionLabel colors={colors}>{eyebrow}</SectionLabel> : null}
          <Text
            accessibilityRole="header"
            style={{
              ...CONSOLE_TEXT.sectionTitle,
              color: colors.ink,
              marginTop: eyebrow ? 3 : 0,
            }}
          >
            {title}
          </Text>
        </View>
        {right}
      </View>
      <View style={{ marginTop: SPACE.x4 }}>{children}</View>
    </View>
  );
}

/** Small, quiet status pill used inside panel headings. */
function CountPill({
  label,
  tone,
  colors,
}: {
  label: string;
  tone: "warning" | "success" | "neutral";
  colors: ThemeTokens;
}) {
  const palette =
    tone === "warning"
      ? { bg: colors.accentWash, fg: colors.accentText }
      : tone === "success"
      ? { bg: colors.jadeWash, fg: colors.jadeText }
      : { bg: colors.panelInset, fg: colors.inkSoft };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderRadius: RADIUS.sm,
        backgroundColor: palette.bg,
        paddingHorizontal: SPACE.x2,
        paddingVertical: 4,
      }}
    >
      <Clock3 size={11} color={palette.fg} strokeWidth={2.4} />
      <Text
        style={{ ...CONSOLE_TEXT.caption, fontSize: 11.5, fontWeight: "700", color: palette.fg }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Review queue ───────────────────────────────────────────────────────────

function QueueRow({
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
  const urgent = age.urgent;

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
          borderRadius: RADIUS.md,
          paddingVertical: SPACE.x3,
          paddingHorizontal: SPACE.x2,
          backgroundColor: hovered ? colors.panelInset : "transparent",
        },
        focusRing(colors, focused),
      ]}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: RADIUS.sm,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: urgent ? colors.coralWash : colors.accentWash,
        }}
      >
        <Icon
          size={15}
          color={urgent ? colors.coralText : colors.accentText}
          strokeWidth={2}
        />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ ...CONSOLE_TEXT.strong, color: colors.ink }}>
          {item.label || "Untitled"}
        </Text>
        <Text
          numberOfLines={1}
          style={{ ...CONSOLE_TEXT.caption, color: colors.inkFaint, marginTop: 1 }}
        >
          {ATTENTION_LABELS[item.kind] || item.kind}
          {item.author ? ` by ${item.author}` : ""}
        </Text>
      </View>

      <Text
        style={{
          ...CONSOLE_TEXT.caption,
          fontSize: 12,
          fontWeight: "600",
          color: urgent ? colors.coralText : colors.inkFaint,
        }}
      >
        {age.label}
      </Text>
      <ChevronRight size={15} color={colors.inkFaint} />
    </Pressable>
  );
}

function QueuePanel({ data, colors }: { data: AdminOverview; colors: ThemeTokens }) {
  const router = useRouter();
  const items = data.needs_attention.slice(0, 6);
  const total = data.needs_attention.length;

  return (
    <Panel
      eyebrow="Moderation"
      title="Review queue"
      colors={colors}
      style={{ flex: 1.5, minWidth: 0 }}
      right={<CountPill label={total > 0 ? `${total} open` : "Clear"} tone={total > 0 ? "warning" : "success"} colors={colors} />}
    >
      <Text style={{ ...CONSOLE_TEXT.caption, color: colors.inkFaint }}>
        Oldest first. Items stay here until they are resolved.
      </Text>

      <View style={{ marginTop: SPACE.x3 }}>
        {items.length === 0 ? (
          <EmptyState
            compact
            icon={ShieldCheck}
            tone="success"
            title="Nothing to review"
            body="The queue is clear. New reports will appear here."
          />
        ) : (
          items.map((item) => (
            <QueueRow
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
            borderRadius: RADIUS.sm,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: pressed ? colors.panelInset : "transparent",
          })}
        >
          <Text
            style={{ ...CONSOLE_TEXT.caption, fontWeight: "700", color: colors.inkSoft }}
          >
            {total > items.length
              ? `View all ${total} in Reports and content`
              : "Open Reports and content"}
          </Text>
          <ArrowRight size={13} color={colors.inkSoft} />
        </Pressable>
      ) : null}
    </Panel>
  );
}

// ─── Quick actions ──────────────────────────────────────────────────────────

function QuickActionsPanel({ data, colors }: { data: AdminOverview; colors: ThemeTokens }) {
  const router = useRouter();
  const openReports =
    data.reports.message_reports +
    data.reports.flagged_posts +
    data.reports.flagged_comments +
    data.reports.flagged_theses;

  const actions = [
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
    <Panel eyebrow="Shortcuts" title="Quick actions" colors={colors} style={{ flex: 1, minWidth: 0 }}>
      <View style={{ marginTop: -4 }}>
        {actions.map((action) => {
          const palette =
            action.tone === "danger"
              ? { bg: colors.coralWash, fg: colors.coralText }
              : action.tone === "success"
              ? { bg: colors.jadeWash, fg: colors.jadeText }
              : action.tone === "warning"
              ? { bg: colors.accentWash, fg: colors.accentText }
              : { bg: colors.brandWash, fg: colors.brand };

          return (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={`${action.label}. ${action.meta}`}
              onPress={() => router.push(action.path as any)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.x3,
                minHeight: 52,
                borderRadius: RADIUS.md,
                paddingHorizontal: SPACE.x2,
                backgroundColor: pressed ? colors.panelInset : "transparent",
              })}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: RADIUS.sm,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: palette.bg,
                }}
              >
                <action.icon size={15} color={palette.fg} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...CONSOLE_TEXT.strong, color: colors.ink }}>
                  {action.label}
                </Text>
                <Text style={{ ...CONSOLE_TEXT.caption, color: colors.inkFaint }}>
                  {action.meta}
                </Text>
              </View>
              <ChevronRight size={15} color={colors.inkFaint} />
            </Pressable>
          );
        })}
      </View>
    </Panel>
  );
}

// ─── Breakdown ──────────────────────────────────────────────────────────────

function LegendRow({
  label,
  value,
  share,
  color,
  colors,
}: {
  label: string;
  value: number;
  share?: number;
  color: string;
  colors: ThemeTokens;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.x2,
        paddingVertical: 6,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ ...CONSOLE_TEXT.caption, color: colors.inkSoft, flex: 1 }}>{label}</Text>
      <Text style={{ ...CONSOLE_TEXT.caption, fontWeight: "700", color: colors.ink }}>
        {formatCount(value)}
      </Text>
      {typeof share === "number" ? (
        <Text
          style={{
            ...CONSOLE_TEXT.caption,
            color: colors.inkFaint,
            minWidth: 34,
            textAlign: "right",
          }}
        >
          {share}%
        </Text>
      ) : null}
    </View>
  );
}

function BreakdownPanel({ data, colors }: { data: AdminOverview; colors: ThemeTokens }) {
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

  return (
    <Panel
      eyebrow="Distribution"
      title="Campus breakdown"
      colors={colors}
      style={{ flex: 1, minWidth: 0 }}
    >
      <Text style={{ ...CONSOLE_TEXT.strong, fontSize: 13, color: colors.inkSoft }}>
        Accounts by role
      </Text>
      <View style={{ marginTop: SPACE.x3 }}>
        <MixBar segments={roles} height={8} />
      </View>
      <View style={{ marginTop: SPACE.x2 }}>
        {roles.map((role) => (
          <LegendRow
            key={role.label}
            label={role.label}
            value={role.value}
            share={percent(role.value, data.users.total)}
            color={role.color}
            colors={colors}
          />
        ))}
      </View>

      <View style={{ height: 1, backgroundColor: colors.line, marginVertical: SPACE.x4 }} />

      <Text style={{ ...CONSOLE_TEXT.strong, fontSize: 13, color: colors.inkSoft }}>
        Content by type
      </Text>
      <View style={{ marginTop: SPACE.x3 }}>
        <MixBar segments={content} height={8} />
      </View>
      <View style={{ marginTop: SPACE.x2 }}>
        {content.map((item) => (
          <LegendRow
            key={item.label}
            label={item.label}
            value={item.value}
            color={item.color}
            colors={colors}
          />
        ))}
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: SPACE.x2,
          marginTop: SPACE.x3,
        }}
      >
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
    </Panel>
  );
}

// ─── Activity ───────────────────────────────────────────────────────────────

function ActivityPanel({ data, colors }: { data: AdminOverview; colors: ThemeTokens }) {
  const router = useRouter();
  const actions = (data.recent_actions || []).slice(0, 5);

  return (
    <Panel
      eyebrow="Audit trail"
      title="Recent activity"
      colors={colors}
      style={{ flex: 1, minWidth: 0 }}
      right={
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(admin)/audit" as any)}
          style={({ pressed }) => ({
            minHeight: 30,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            borderRadius: RADIUS.sm,
            backgroundColor: pressed ? colors.panelInset : "transparent",
            paddingHorizontal: SPACE.x2,
          })}
        >
          <Text
            style={{ ...CONSOLE_TEXT.caption, fontSize: 12, fontWeight: "700", color: colors.brand }}
          >
            Open audit log
          </Text>
          <ArrowRight size={12} color={colors.brand} />
        </Pressable>
      }
    >
      {actions.length === 0 ? (
        <EmptyState
          compact
          icon={ShieldCheck}
          tone="brand"
          title="No activity yet"
          body="Role changes and moderation decisions will appear here."
        />
      ) : (
        <View>
          {actions.map((entry, index) => (
            <View
              key={entry.id}
              style={{
                flexDirection: "row",
                gap: SPACE.x3,
                paddingBottom: index === actions.length - 1 ? 0 : SPACE.x4,
              }}
            >
              <View style={{ alignItems: "center", paddingTop: 3 }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: colors.brandBright,
                  }}
                />
                {index === actions.length - 1 ? null : (
                  <View
                    style={{ width: 1, flex: 1, backgroundColor: colors.line, marginTop: 4 }}
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
                  <Text
                    numberOfLines={1}
                    style={{ ...CONSOLE_TEXT.strong, color: colors.ink, flexShrink: 1 }}
                  >
                    {ACTION_LABELS[entry.action as string] ||
                      (typeof entry.action === "string" ? entry.action : "Unknown action")}
                  </Text>
                  <Text style={{ ...CONSOLE_TEXT.caption, fontSize: 11.5, color: colors.inkFaint }}>
                    {timeAgo(entry.created_at)}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{ ...CONSOLE_TEXT.caption, color: colors.inkSoft, marginTop: 1 }}
                >
                  {typeof entry.actor_username === "string" ? entry.actor_username : "system"} ·{" "}
                  {typeof entry.target_label === "string"
                    ? entry.target_label
                    : typeof entry.target_type === "string"
                    ? entry.target_type
                    : "item"}
                </Text>
                {typeof entry.reason === "string" && entry.reason ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      ...CONSOLE_TEXT.caption,
                      fontSize: 11.5,
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
          ))}
        </View>
      )}
    </Panel>
  );
}

/** What a standard administrator sees in place of the superadmin audit trail. */
function SnapshotPanel({ data, colors }: { data: AdminOverview; colors: ThemeTokens }) {
  const rows = [
    {
      label: "Hidden content",
      value: data.content.hidden,
      icon: EyeOff,
      tone: { bg: colors.panelInset, fg: colors.inkSoft },
    },
    {
      label: "Flagged content",
      value: data.content.flagged,
      icon: AlertTriangle,
      tone: { bg: colors.accentWash, fg: colors.accentText },
    },
    {
      label: "Suspended accounts",
      value: data.users.suspended,
      icon: ShieldAlert,
      tone: { bg: colors.coralWash, fg: colors.coralText },
    },
    {
      label: "Announcements in 30 days",
      value: data.announcements.sent_30d,
      icon: Megaphone,
      tone: { bg: colors.brandWash, fg: colors.brand },
    },
  ];

  return (
    <Panel eyebrow="Oversight" title="Current status" colors={colors} style={{ flex: 1, minWidth: 0 }}>
      {rows.map((row) => (
        <View
          key={row.label}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.x3,
            paddingVertical: SPACE.x2,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: RADIUS.sm,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: row.tone.bg,
            }}
          >
            <row.icon size={15} color={row.tone.fg} strokeWidth={2} />
          </View>
          <Text style={{ ...CONSOLE_TEXT.body, color: colors.inkSoft, flex: 1 }}>
            {row.label}
          </Text>
          <Text style={{ ...CONSOLE_TEXT.metricSmall, color: colors.ink }}>
            {formatCount(row.value)}
          </Text>
        </View>
      ))}

      <Text
        style={{
          ...CONSOLE_TEXT.caption,
          color: colors.inkFaint,
          marginTop: SPACE.x3,
        }}
      >
        {formatCount(data.announcements.recipients_30d)} notifications reached the campus in the
        last 30 days.
      </Text>
    </Panel>
  );
}

// ─── Loading ────────────────────────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <View style={{ gap: SPACE.x5 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.x4 }}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={{ flex: 1, minWidth: 216 }}>
            <Skeleton height={148} radius={RADIUS.lg} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.x5 }}>
        <View style={{ flex: 1.5, minWidth: 300 }}>
          <Skeleton height={300} radius={RADIUS.lg} />
        </View>
        <View style={{ flex: 1, minWidth: 260 }}>
          <Skeleton height={300} radius={RADIUS.lg} />
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.x5 }}>
        <View style={{ flex: 1, minWidth: 300 }}>
          <Skeleton height={320} radius={RADIUS.lg} />
        </View>
        <View style={{ flex: 1, minWidth: 300 }}>
          <Skeleton height={320} radius={RADIUS.lg} />
        </View>
      </View>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

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
  const stackColumns = width < 1100;
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
      <View style={{ width: "100%", maxWidth: 1360 }}>
        <PageHeader
          eyebrow="Admin console"
          title="Overview"
          description="Accounts, content and the moderation queue at a glance."
          meta={
            data ? `Last updated ${new Date(data.generated_at).toLocaleString()}` : undefined
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
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: colors.coral,
              backgroundColor: colors.coralWash,
              padding: SPACE.x4,
            }}
          >
            <AlertTriangle size={17} color={colors.coralText} />
            <Text style={{ ...CONSOLE_TEXT.body, color: colors.coralText, flex: 1 }}>
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading the overview"
              onPress={() => void load()}
              style={({ pressed }) => ({
                minHeight: 32,
                borderRadius: RADIUS.sm,
                borderWidth: 1,
                borderColor: colors.coral,
                paddingHorizontal: SPACE.x3,
                paddingVertical: 5,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text
                style={{ ...CONSOLE_TEXT.caption, fontWeight: "700", color: colors.coralText }}
              >
                Try again
              </Text>
            </Pressable>
          </View>
        ) : null}

        {loading && !data ? (
          <OverviewSkeleton />
        ) : data ? (
          <View style={{ gap: SPACE.x5 }}>
            <Reveal>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.x4 }}>
                <KpiCard
                  label="Accounts"
                  value={data.users.total}
                  detail={`${formatCount(data.users.students)} students, ${formatCount(
                    data.users.faculty
                  )} faculty`}
                  icon={Users}
                  tone="brand"
                  onPress={() => router.push("/(admin)/users" as any)}
                  footer={
                    <Text style={{ ...CONSOLE_TEXT.caption, fontSize: 11.5, color: colors.inkFaint }}>
                      {formatCount(data.users.new_7d)} joined in the last 7 days
                    </Text>
                  }
                />
                <KpiCard
                  label="Active this week"
                  value={data.users.active_7d}
                  detail={`${percent(data.users.active_7d, data.users.total)}% of accounts checked in`}
                  icon={Activity}
                  tone="jade"
                  footer={
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
                  }
                />
                <KpiCard
                  label="Open reports"
                  value={openReports}
                  detail={`${formatCount(data.reports.message_reports)} messages, ${formatCount(
                    flaggedTotal
                  )} flagged items`}
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
                          ...CONSOLE_TEXT.caption,
                          fontSize: 11.5,
                          color: oldest ? colors.coralText : colors.jadeText,
                        }}
                      >
                        {oldest
                          ? `Oldest waiting ${ageInfo(oldest.created_at).label}`
                          : "Queue is clear"}
                      </Text>
                    </View>
                  }
                />
                <KpiCard
                  label="Content library"
                  value={contentTotal}
                  detail={`${formatCount(data.content.posts)} posts, ${formatCount(
                    data.content.theses
                  )} theses`}
                  icon={FileText}
                  tone="accent"
                  onPress={() => router.push("/(admin)/content" as any)}
                  footer={
                    <Text style={{ ...CONSOLE_TEXT.caption, fontSize: 11.5, color: colors.inkFaint }}>
                      {formatCount(data.content.comments)} comments published alongside
                    </Text>
                  }
                />
              </View>
            </Reveal>

            <Reveal delay={80}>
              <View
                style={{
                  flexDirection: stackColumns ? "column" : "row",
                  gap: SPACE.x5,
                  alignItems: "stretch",
                }}
              >
                <QueuePanel data={data} colors={colors} />
                <QuickActionsPanel data={data} colors={colors} />
              </View>
            </Reveal>

            <Reveal delay={160}>
              <View
                style={{
                  flexDirection: stackColumns ? "column" : "row",
                  gap: SPACE.x5,
                  alignItems: "stretch",
                }}
              >
                <BreakdownPanel data={data} colors={colors} />
                {superadmin ? (
                  <ActivityPanel data={data} colors={colors} />
                ) : (
                  <SnapshotPanel data={data} colors={colors} />
                )}
              </View>
            </Reveal>
          </View>
        ) : (
          <View style={{ ...consoleCard(colors) }}>
            <EmptyState
              icon={WifiOff}
              tone="danger"
              title="Could not load the overview"
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
