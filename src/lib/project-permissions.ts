/**
 * Project Permission Registry & Helpers
 *
 * Mirrors the pattern of `src/lib/permissions.ts` (IISE General) but scoped
 * to project-level authorization.
 *
 * Authority is resolved from the `projectRolePermissions` table via the
 * membership's `projectRole.permissions` relation — no booleans, no magic numbers.
 *
 * `hierarchyLevel` is kept ONLY for:
 *   1. Hierarchy guard (can't modify someone at or above your level)
 *   2. Visual ordering in the UI
 */

import { hasPermission } from "@/lib/permissions";

// =============================================================================
// Permission Registry (16 strings)
// =============================================================================

export const PROJECT_PERMISSIONS = [
  // Events
  "project:event_create_any",
  "project:event_create_own_area",
  "project:event_manage_any",
  "project:event_manage_own",
  "project:event_view_all",
  // Tasks
  "project:task_create_any",
  "project:task_create_own_area",
  "project:task_manage_any",
  "project:task_manage_own",
  "project:task_assign",
  "project:task_update_status",
  // Management
  "project:manage_settings",
  "project:manage_members",
  "project:manage_status",
  "project:delete",
  // Visibility
  "project:view_all_areas",
] as const;

export type ProjectPermission = (typeof PROJECT_PERMISSIONS)[number];

// =============================================================================
// Membership type expected by helpers
// =============================================================================

export interface MembershipWithPerms {
  projectRole: {
    hierarchyLevel: number;
    permissions: { permission: string }[];
  };
  projectAreaId: string | null;
}

// =============================================================================
// Permission Check Helpers
// =============================================================================

/** Check if a membership has a specific project permission */
export function hasProjectPermission(
  membership: MembershipWithPerms | null | undefined,
  permission: ProjectPermission,
): boolean {
  if (!membership) return false;
  return membership.projectRole.permissions.some(
    (p) => p.permission === permission,
  );
}

/** Check if a membership has ANY of the given permissions (OR logic) */
export function hasAnyProjectPermission(
  membership: MembershipWithPerms | null | undefined,
  permissions: ProjectPermission[],
): boolean {
  if (!membership) return false;
  return permissions.some((perm) =>
    membership.projectRole.permissions.some((p) => p.permission === perm),
  );
}

// =============================================================================
// IISE-level Bypass
// =============================================================================

/**
 * Returns true if the user has the global `project:manage` IISE permission,
 * which acts as a bypass for ALL project-level checks.
 */
export function canBypassProjectPerms(
  role: string,
  customPermissions?: string[],
): boolean {
  return hasPermission(role, "project:manage", customPermissions);
}

// =============================================================================
// Default Permission Map (used by seed & admin panel)
// =============================================================================

/** Default permissions for each system role, keyed by role name */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, ProjectPermission[]> = {
  "Coordinador / Project Management": [
    "project:event_create_any",
    "project:event_create_own_area",
    "project:event_manage_any",
    "project:event_manage_own",
    "project:event_view_all",
    "project:task_create_any",
    "project:task_create_own_area",
    "project:task_manage_any",
    "project:task_manage_own",
    "project:task_assign",
    "project:task_update_status",
    "project:manage_settings",
    "project:manage_members",
    "project:manage_status",
    "project:delete",
    "project:view_all_areas",
  ],
  "Director de proyecto": [
    "project:event_create_any",
    "project:event_create_own_area",
    "project:event_manage_any",
    "project:event_manage_own",
    "project:event_view_all",
    "project:task_create_any",
    "project:task_create_own_area",
    "project:task_manage_any",
    "project:task_manage_own",
    "project:task_assign",
    "project:task_update_status",
    "project:manage_settings",
    "project:manage_members",
    "project:manage_status",
    "project:view_all_areas",
  ],
  "Subdirector de proyecto": [
    "project:event_create_any",
    "project:event_create_own_area",
    "project:event_manage_any",
    "project:event_manage_own",
    "project:event_view_all",
    "project:task_create_any",
    "project:task_create_own_area",
    "project:task_manage_any",
    "project:task_manage_own",
    "project:task_assign",
    "project:task_update_status",
    "project:manage_settings",
    "project:manage_members",
    "project:view_all_areas",
  ],
  "Tesorero de proyecto": [
    "project:event_create_any",
    "project:event_create_own_area",
    "project:event_manage_own",
    "project:task_create_any",
    "project:task_create_own_area",
    "project:task_manage_own",
    "project:task_update_status",
  ],
  "Director de Área": [
    "project:event_create_own_area",
    "project:event_manage_own",
    "project:task_create_own_area",
    "project:task_manage_own",
    "project:task_update_status",
  ],
  "Miembro de Área": [
  ],
};
