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
    "user:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Áreas ---
    "area:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Proyectos ---
    "project:create": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR"],
    "project:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Dashboard / Vistas ---
    "dashboard:area_comparison":  ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
    "dashboard:leadership_view":  ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],

    // --- Admin panel access (route-level) ---
    "admin:access": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
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
    return false;
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
