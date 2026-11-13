import { apiJson } from "./api";
import type { CanonicalRole } from "./roles";

/** Content types used in moderation. */
export type ContentType = "post" | "thesis" | "comment";

/** Moderation actions available for content. */
export type ModerationAction = "approve" | "hide" | "delete" | "restore";

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

export type AttentionItem = {
  kind: string;
  id: string;
  label: string;
  author: string | null;
  created_at: string;
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
    reposts: number;
    hidden: number;
    flagged: number;
    reports: {
      message_reports: number;
      flagged_posts: number;
      flagged_comments: number;
      flagged_theses: number;
    };
  };
  messaging: {
    conversations: number;
    messages_7d: number;
  };
  verification: {
    pending: number;
    approved_30d: number;
    declined_30d: number;
  };
  announcements: {
    sent_30d: number;
    recipients_30d: number;
  };
  generated_at: string;
  needs_attention: AttentionItem[];
  reports: {
    message_reports: number;
    flagged_posts: number;
    flagged_comments: number;
    flagged_theses: number;
  };
  recent_actions?: AuditEntry[];
};

/** Who the announcement reaches. Mirrors the server's discriminated union. */
export type AnnouncementAudience =
  | { type: "all" }
  | { type: "role"; role: CanonicalRole }
  | { type: "department"; department_id: string }
  | { type: "course"; course_id: string }
  | { type: "year_level"; year_level: string };

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  pinned: boolean;
  expires_at: string | null;
  recipients: number;
  actor_username: string | null;
  created_at: string;
  author_name?: string | null;
  author_department_name?: string | null;
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

export type AdminContentItem = {
  id: string;
  type: "post" | "thesis" | "comment";
  title: string;
  excerpt?: string;
  status: string;
  author_id: string;
  author_name: string | null;
  author_username: string | null;
  author?: string | null;
  department_name: string | null;
  created_at: string;
};

export type AuditEntry = {
  id: string;
  actor_id: string;
  actor_name: string | null;
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

type Paged<T> = { items: T[]; total: number; next_cursor: string | null };

function queryString(params: Record<string, string | number | null | undefined>) {
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join("&")}` : "";
}

const validateNonEmptyReason = (reason: string, label: string): string => {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error(`${label} requires a non-empty reason`);
  }
  return trimmed;
};

export function getAdminOverview(): Promise<AdminOverview> {
  return apiJson<AdminOverview>("/admin/overview");
}

export function listAdminUsers(params: {
  q?: string;
  role?: string;
  department_id?: string;
  status?: string;
  limit?: number;
  cursor?: string | null;
}): Promise<Paged<AdminUser>> {
  return apiJson<Paged<AdminUser>>(`/admin/users${queryString(params)}`);
}

export function getAdminUser(id: string): Promise<AdminDossier> {
  return apiJson<AdminDossier>(`/admin/users/${encodeURIComponent(id)}`);
}

export function changeUserRole(id: string, role: CanonicalRole, reason: string): Promise<void> {
  return apiJson(`/admin/users/${encodeURIComponent(id)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role, reason: validateNonEmptyReason(reason, "changeUserRole") }),
  });
}

export function suspendUser(
  id: string,
  reason: string,
  until?: string | null
): Promise<void> {
  if (until !== null && until !== undefined) {
    const d = new Date(until);
    if (isNaN(d.getTime())) {
      throw new Error("suspendUser requires a valid until date or null");
    }
  }
  return apiJson(`/admin/users/${encodeURIComponent(id)}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason: validateNonEmptyReason(reason, "suspendUser"), until: until || null }),
  });
}

export function unsuspendUser(id: string, reason: string): Promise<void> {
  return apiJson(`/admin/users/${encodeURIComponent(id)}/unsuspend`, {
    method: "POST",
    body: JSON.stringify({ reason: validateNonEmptyReason(reason, "unsuspendUser") }),
  });
}

export function forceSignOut(id: string, reason: string): Promise<void> {
  return apiJson(`/admin/users/${encodeURIComponent(id)}/force-signout`, {
    method: "POST",
    body: JSON.stringify({ reason: validateNonEmptyReason(reason, "forceSignOut") }),
  });
}

// Account deletion removed per policy: permanent deletion is manual DB query only.
// Admins/superadmins can only suspend/disable accounts via suspendUser/unsuspendUser.

export function listAdminContent(params: {
  type?: string;
  status?: string;
  q?: string;
  department_id?: string;
  author_id?: string;
  limit?: number;
  cursor?: string | null;
}): Promise<Paged<AdminContentItem>> {
  return apiJson<Paged<AdminContentItem>>(`/admin/content${queryString(params)}`);
}

export function moderateContent(
  type: "post" | "thesis" | "comment",
  id: string,
  action: ModerationAction,
  reason: string
): Promise<void> {
  const route = type === "thesis" ? "theses" : `${type}s`;
  return apiJson(`/moderation/${route}/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({ action, reason: validateNonEmptyReason(reason, "moderateContent") }),
  });
}

export function resolveMessageReport(
  id: string,
  action: "reviewed" | "dismissed",
  reason: string
): Promise<void> {
  return apiJson(`/moderation/message-reports/${encodeURIComponent(id)}`, {
    method: "POST",
    body: JSON.stringify({ action, reason: validateNonEmptyReason(reason, "resolveMessageReport") }),
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
}): Promise<Paged<AuditEntry>> {
  return apiJson<Paged<AuditEntry>>(`/admin/audit${queryString(params)}`);
}

export function getAudienceCount(audience: AnnouncementAudience): Promise<{ count: number }> {
  return apiJson<{ count: number }>(`/announcements/audience-count${queryString(audience as any)}`);
}

export function sendAnnouncement(input: {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  pinned?: boolean;
  expires_at?: string | null;
}): Promise<{ id: string; recipients: number }> {
  return apiJson<{ id: string; recipients: number }>("/announcements", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listAnnouncements(params: {
  limit?: number;
  cursor?: string | null;
}): Promise<Paged<Announcement>> {
  return apiJson<Paged<Announcement>>(`/announcements${queryString(params)}`);
}

export function updateAnnouncement(
  id: string,
  input: {
    title?: string;
    body?: string;
    pinned?: boolean;
    expires_at?: string | null;
  }
): Promise<Announcement | null> {
  return apiJson<Announcement | null>(`/announcements/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAnnouncement(id: string): Promise<void> {
  return apiJson(`/announcements/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function checkAdminSessionStatus(): Promise<{ isAdmin: boolean; valid: boolean; remainingMs: number }> {
  try {
    return await apiJson<{ isAdmin: boolean; valid: boolean; remainingMs: number }>("/auth/mfa/admin-session");
  } catch {
    return { isAdmin: false, valid: false, remainingMs: 0 };
  }
}

export async function stepUpAdminMfa(code: string): Promise<{ ok: boolean; message: string }> {
  return await apiJson<{ ok: boolean; message: string }>("/auth/mfa/step-up", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}