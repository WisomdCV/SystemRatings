// =============================================================================
// SISTEMA CENTRALIZADO DE PERMISOS
// =============================================================================
// Cada clave define un permiso y su valor es la lista de roles autorizados.
// Para modificar quién puede hacer qué, edita SOLO este archivo.
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
// Mapa de Permisos
// ---------------------------------------------------------------------------
export const PERMISSIONS = {
    // --- Eventos ---
    "event:create": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
    "event:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"], // Delete/update any event

    // --- Asistencia ---
    "attendance:take": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
    "attendance:review": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],

    // --- Calificaciones ---
    "grade:assign": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR"],
    "grade:view_sheet": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],

    // --- Pilares ---
    "pillar:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Semestres / Ciclos ---
    "semester:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
    "semester:create_first": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR", "MEMBER", "VOLUNTEER"],

    // --- Usuarios ---
    "user:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Áreas ---
    "area:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Proyectos ---
    "project:create": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR"],
    "project:manage": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],

    // --- Dashboard / Vistas ---
    "dashboard:area_comparison": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
    "dashboard:leadership_view": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],

    // --- Admin panel access (route-level) ---
    "admin:access": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER", "DIRECTOR", "SUBDIRECTOR"],
    "admin:full": ["DEV", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verifica si un rol tiene un permiso específico.
 * Chequea primero los permisos del rol del sistema (hardcoded),
 * luego los permisos de roles personalizables (custom).
 */
export function hasPermission(
    role: string | null | undefined,
    permission: Permission,
    customPermissions?: string[]
): boolean {
    // 1. Chequear permisos del rol del sistema (hardcoded)
    if (role && (PERMISSIONS[permission] as readonly string[]).includes(role)) return true;
    // 2. Chequear permisos de roles personalizables
    if (customPermissions?.includes(permission)) return true;
    return false;
}

/**
 * Verifica si un rol es de nivel administrativo (DEV o PRESIDENT).
 * Útil para bypasses de permisos granulares (ej: ver todas las áreas).
 */
export function isAdmin(role: string | null | undefined): boolean {
    return hasPermission(role, "admin:full");
}

/**
 * Verifica si un rol es de nivel directivo (DIRECTOR, SUBDIRECTOR).
 * Útil para checks de alcance por área.
 */
export function isDirectorLevel(role: string | null | undefined): boolean {
    if (!role) return false;
    return ["DIRECTOR", "SUBDIRECTOR"].includes(role);
}
