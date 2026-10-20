import { apiJson } from "./api";
import type { CanonicalRole } from "./roles";

export type AdminUser = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string | null;
  course: string | null;
  course_id: string | null;
  course_name: string | null;
  year_level: string | null;
  department_id: string | null;
  department_name: string | null;
  skills: string[] | null;
  created_at: string;
  last_seen_at: string | null;
  suspended_at: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
  suspended_by: string | null;
  status: "active" | "suspended";
};

export type AdminOverview = {
  users: {
    total: number;
    students: number;
    faculty: number;
    department_admins: number;
    admins: number;
    superadmins: number;
    suspended: number;
    active_7d: number;
    new_7d: number;
  };
  content: {
    posts: number;
    theses: number;
    comments: number;
    hidden: number;
    flagged: number;
  };
  reports: {
    message_reports: number;
    flagged_posts: number;
    flagged_comments: number;
    flagged_theses: number;
  };
  announcements: { sent_30d: number; recipients_30d: number };
  needs_attention: {
    kind: string;
    id: string;
    label: string;
    author: string | null;
    created_at: string;
  }[];
  recent_actions?: AuditEntry[];
  generated_at: string;
};

export type AdminContentItem = {
  type: "post" | "comment" | "thesis";
  id: string;
  title: string;
  excerpt: string;
  author: {
    id: string | null;
    username: string | null;
    full_name: string | null;
  };
  department_id: string | null;
  department_name: string | null;
  status: string;
  moderation_reason: string | null;
  created_at: string;
  app_path: string | null;
  parent_id: string | null;
};

export type ContentType = AdminContentItem["type"];
export type ModerationAction = "restore" | "hide" | "delete";

export type AuditEntry = {
  id: string;
  actor_id: string;
  actor_username: string | null;
  actor_role: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  reason: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience:
    | { type: "all" }
    | { type: "role"; role: CanonicalRole }
    | { type: "department"; department_id: string };
  recipients: number;
  actor_username: string | null;
  created_at: string;
};

export type AdminDossier = AdminUser & {
  email: string | null;
  counts: {
    posts: number;
    theses: number;
    comments: number;
    likes_given: number;
    message_reports_against: number;
  };
  recent_content: {
    type: "post" | "thesis";
    id: string;
    title: string;
    status: string;
    created_at: string;
    app_path: string | null;
  }[];
  sanctions: AuditEntry[];
};

type Paged<T> = { items: T[]; total: number; next_cursor: string | null };

function queryString(params: Record<string, string | number | null | undefined>) {
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    );
  return pairs.length ? `?${pairs.join("&")}` : "";
}

export function getAdminOverview() {
  return apiJson<AdminOverview>("/admin/overview");
}

export function listAdminUsers(params: {
  q?: string;
  role?: string;
  department_id?: string;
  status?: string;
  limit?: number;
  cursor?: string | null;
}) {
  return apiJson<Paged<AdminUser>>(`/admin/users${queryString(params)}`);
}

export function getAdminUser(id: string) {
  return apiJson<AdminDossier>(`/admin/users/${encodeURIComponent(id)}`);
}

export function changeUserRole(id: string, role: CanonicalRole, reason: string) {
  return apiJson(`/admin/users/${encodeURIComponent(id)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role, reason }),
  });
}

export function suspendUser(
  id: string,
  reason: string,
  until?: string | null
) {
  return apiJson(`/admin/users/${encodeURIComponent(id)}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason, until: until || null }),
  });
}

export function unsuspendUser(id: string, reason: string) {
  return apiJson(`/admin/users/${encodeURIComponent(id)}/unsuspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function forceSignOut(id: string, reason: string) {
  return apiJson(`/admin/users/${encodeURIComponent(id)}/force-signout`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function deleteAdminUser(id: string, reason: string) {
  return apiJson(`/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  });
}

export function listAdminContent(params: {
  type?: string;
  status?: string;
  q?: string;
  department_id?: string;
  author_id?: string;
  limit?: number;
  cursor?: string | null;
}) {
  return apiJson<Paged<AdminContentItem>>(`/admin/content${queryString(params)}`);
}

export function moderateContent(
  type: ContentType,
  id: string,
  action: ModerationAction,
  reason: string
) {
  const route = type === "thesis" ? "theses" : `${type}s`;
  return apiJson(`/moderation/${route}/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });
}

export function resolveMessageReport(
  id: string,
  action: "reviewed" | "dismissed",
  reason: string
) {
  return apiJson(`/moderation/message-reports/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });
}

export function listAdminAudit(params: {
  actor_id?: string;
  action?: string;
  target_type?: string;
  target_id?: string;
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
  cursor?: string | null;
}) {
  return apiJson<Paged<AuditEntry>>(`/admin/audit${queryString(params)}`);
}

export function getAudienceCount(audience: {
  type: "all" | "role" | "department";
  role?: string;
  department_id?: string;
}) {
  return apiJson<{ count: number }>(
    `/admin/announcements/audience-count${queryString({
      type: audience.type,
      role: audience.role,
      department_id: audience.department_id,
    })}`
  );
}

export function sendAnnouncement(input: {
  title: string;
  body: string;
  audience:
    | { type: "all" }
    | { type: "role"; role: CanonicalRole }
    | { type: "department"; department_id: string };
}) {
  return apiJson<{ id: string; recipients: number }>("/admin/announcements", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listAnnouncements(params: { limit?: number; cursor?: string | null }) {
  return apiJson<Paged<Announcement>>(
    `/admin/announcements${queryString(params)}`
  );
}
