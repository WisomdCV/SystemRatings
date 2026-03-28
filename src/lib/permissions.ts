// =============================================================================
// SISTEMA CENTRALIZADO DE PERMISOS v2
// =============================================================================
// Cada clave define un permiso y su valor es la lista de roles del SISTEMA
// que lo tienen POR DEFECTO. Estos defaults se complementan con:
//   - Layer 2: Custom Roles (per-user, via custom_role_permissions table)
//   - Layer 3: Area Permissions (per-area, via area_permissions table)
//
// Para cambiar defaults de rol, edita PERMISSIONS.
// Para cambiar permisos de área o usuario, usa el admin UI (DB).
// =============================================================================

export const ROLES = [
    "DEV",
    "PRESIDENT",
    "VICEPRESIDENT",
    "SECRETARY",
    "DIRECTOR",
    "SUBDIRECTOR",
    "TREASURER",
    "MEMBER",
    "VOLUNTEER",
] as const;

export type Role = (typeof ROLES)[number];

// ---------------------------------------------------------------------------
// Jerarquia de roles para control de cambios de usuarios
// Regla: solo se puede modificar/asignar a roles estrictamente menores.
// ---------------------------------------------------------------------------
export const USER_ROLE_HIERARCHY = [
    "DEV",
    "PRESIDENT",
    "VICEPRESIDENT",
    "SECRETARY",
    "TREASURER",
    "DIRECTOR",
    "SUBDIRECTOR",
    "MEMBER",
    "VOLUNTEER",
] as const;

const USER_PERMISSION_LEGACY = "user:manage" as const;
const USER_PERMISSION_SPLIT = [
    "user:approve",
    "user:manage_role",
    "user:manage_data",
    "user:moderate",
] as const;

const ADMIN_PERMISSION_LEGACY = "admin:full" as const;
const ADMIN_PERMISSION_ROLES = "admin:roles" as const;
const ADMIN_PERMISSION_AUDIT = "admin:audit" as const;

const DASHBOARD_PERMISSION_ANALYTICS = "dashboard:analytics" as const;
const DASHBOARD_PERMISSION_LEGACY = [
    "dashboard:area_comparison",
    "dashboard:leadership_view",
] as const;

// ---------------------------------------------------------------------------
// Mapa de Permisos (Layer 1: System Role Defaults)
// ---------------------------------------------------------------------------
export const PERMISSIONS = {
    // --- Eventos IISE ---
    "event:create_general":    ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "event:create_area_own":   ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
    "event:create_area_any":   ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "event:create_meeting":    ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "event:manage_own":        ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
    "event:manage_all":        ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Asistencia ---
    "attendance:take_own_area":   ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
    "attendance:take_all":        ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "attendance:review_own_area": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
    "attendance:review_all":      ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Calificaciones ---
    "grade:assign_own_area": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "grade:assign_all":      ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "grade:view_own_area":   ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "grade:view_all":        ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Pilares ---
    "pillar:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Semestres / Ciclos ---
    "semester:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Usuarios ---
    "user:approve": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "user:manage_role": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "user:manage_data": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "user:moderate": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    // Legacy compatibility: mantener temporalmente durante la migracion.
    "user:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Áreas ---
    "area:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Proyectos ---
    "project:create": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR"],
    "project:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Dashboard / Vistas ---
    "dashboard:analytics":      ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
    "dashboard:area_comparison":  ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
    "dashboard:leadership_view":  ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],

    // --- Admin panel access (route-level) ---
    "admin:access": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
    "admin:audit":  ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "admin:roles":  ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "admin:full":   ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

// ---------------------------------------------------------------------------
// All permission keys (useful for admin UI dropdowns)
// ---------------------------------------------------------------------------
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verifica si un rol tiene un permiso específico.
 * Chequea primero los permisos del rol del sistema (Layer 1),
 * luego los permisos personalizados que incluyen custom roles (Layer 2)
 * y area permissions (Layer 3), ambos fusionados en customPermissions.
 */
export function hasPermission(
    role: string | null | undefined,
    permission: Permission,
    customPermissions?: string[]
): boolean {
    // Layer 1: System role defaults
    if (role && (PERMISSIONS[permission] as readonly string[]).includes(role)) return true;
    // Layer 2+3: Custom role permissions + Area permissions (merged)
    if (customPermissions?.includes(permission)) return true;

    // Compatibilidad transitoria user:* <-> user:manage (solo para custom permissions).
    const splitUserPerms = USER_PERMISSION_SPLIT as readonly string[];
    if (
        permission === USER_PERMISSION_LEGACY &&
        splitUserPerms.some((perm) => customPermissions?.includes(perm))
    ) {
        return true;
    }
    if (
        splitUserPerms.includes(permission) &&
        customPermissions?.includes(USER_PERMISSION_LEGACY)
    ) {
        return true;
    }

    // Compatibilidad transitoria admin:* (admin:full <-> admin:roles/audit).
    if (
        (permission === ADMIN_PERMISSION_AUDIT || permission === ADMIN_PERMISSION_ROLES) &&
        customPermissions?.includes(ADMIN_PERMISSION_LEGACY)
    ) {
        return true;
    }
    if (
        permission === ADMIN_PERMISSION_LEGACY &&
        customPermissions?.includes(ADMIN_PERMISSION_ROLES)
    ) {
        return true;
    }

    // Compatibilidad transitoria dashboard:* (analytics <-> area_comparison/leadership_view).
    const dashboardLegacyPerms = DASHBOARD_PERMISSION_LEGACY as readonly string[];
    if (
        permission === DASHBOARD_PERMISSION_ANALYTICS &&
        dashboardLegacyPerms.some((perm) => customPermissions?.includes(perm))
    ) {
        return true;
    }
    if (
        dashboardLegacyPerms.includes(permission) &&
        customPermissions?.includes(DASHBOARD_PERMISSION_ANALYTICS)
    ) {
        return true;
    }

    return false;
}

/**
 * Retorna el ranking jerarquico de un rol. Menor valor = mayor jerarquia.
 */
export function getRoleHierarchyRank(role: string | null | undefined): number {
    if (!role) return Number.POSITIVE_INFINITY;
    const idx = USER_ROLE_HIERARCHY.indexOf(role as (typeof USER_ROLE_HIERARCHY)[number]);
    return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

/**
 * Regla jerarquica para modificar usuarios:
 * - Solo se puede modificar a usuarios de rango estrictamente menor.
 * - No se puede modificar a pares ni superiores.
 */
export function canManageUserByHierarchy(
    actorRole: string | null | undefined,
    targetRole: string | null | undefined
): boolean {
    const actorRank = getRoleHierarchyRank(actorRole);
    const targetRank = getRoleHierarchyRank(targetRole);
    if (!Number.isFinite(actorRank)) return false;
    return actorRank < targetRank;
}

/**
 * Regla jerarquica para asignar rol:
 * - Solo DEV puede asignar DEV.
 * - Un actor no puede asignar su mismo rango ni uno superior.
 */
export function canAssignRoleByHierarchy(
    actorRole: string | null | undefined,
    nextRole: string | null | undefined
): boolean {
    if (!actorRole || !nextRole) return false;
    if (nextRole === "DEV") return actorRole === "DEV";

    const actorRank = getRoleHierarchyRank(actorRole);
    const nextRank = getRoleHierarchyRank(nextRole);
    if (!Number.isFinite(actorRank) || !Number.isFinite(nextRank)) return false;
    return actorRank < nextRank;
}

/**
 * Verifica si un rol es de nivel administrativo (tiene admin:full).
 */
export function isAdmin(role: string | null | undefined): boolean {
    return hasPermission(role, "admin:full");
}

/**
 * Verifica si un rol es de nivel directivo (DIRECTOR, SUBDIRECTOR).
 */
export function isDirectorLevel(role: string | null | undefined): boolean {
    if (!role) return false;
    return ["DIRECTOR", "SUBDIRECTOR"].includes(role);
}
