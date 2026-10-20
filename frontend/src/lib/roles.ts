/**
 * Canonical role vocabulary shared by the panel UI.
 *
 * The server remains the authorization source of truth. These helpers only
 * mirror its rank rules so controls can be disabled before a request is made.
 */
export type CanonicalRole =
  | "student"
  | "faculty"
  | "departmentAdmin"
  | "admin"
  | "superadmin";

const RANK: Record<CanonicalRole, number> = {
  student: 0,
  faculty: 1,
  departmentAdmin: 2,
  admin: 3,
  superadmin: 4,
};

const CANONICAL: Record<string, CanonicalRole> = {
  student: "student",
  faculty: "faculty",
  departmentadmin: "departmentAdmin",
  admin: "admin",
  superadmin: "superadmin",
};

export function normalizeRole(role?: string | null): string {
  return (role || "").toLowerCase().replace(/[-_]/g, "");
}

export function canonicalRole(role?: string | null): CanonicalRole | null {
  return CANONICAL[normalizeRole(role)] || null;
}

export function rankOf(role?: string | null): number {
  const canonical = canonicalRole(role);
  return canonical ? RANK[canonical] : -1;
}

export function isAdminRole(role?: string | null): boolean {
  return rankOf(role) >= RANK.admin;
}

export function isSuperAdminRole(role?: string | null): boolean {
  return rankOf(role) === RANK.superadmin;
}

/** Strictly lower rank only; self is handled separately by the caller. */
export function canManageRole(
  caller?: string | null,
  target?: string | null
): boolean {
  return isAdminRole(caller) && rankOf(caller) > rankOf(target);
}

/** Roles the caller may assign. The target-rank check still applies. */
export function grantableRoles(caller?: string | null): CanonicalRole[] {
  const rank = rankOf(caller);
  if (rank < RANK.admin) return [];
  return (Object.keys(RANK) as CanonicalRole[]).filter((role) => {
    if (role === "admin" || role === "superadmin") return rank === RANK.superadmin;
    return RANK[role] < rank;
  });
}

export function isSuspendedProfile(profile?: {
  suspended_at?: string | null;
  suspended_until?: string | null;
} | null): boolean {
  if (!profile?.suspended_at) return false;
  if (!profile.suspended_until) return true;
  const until = new Date(profile.suspended_until).getTime();
  return Number.isFinite(until) && until > Date.now();
}
