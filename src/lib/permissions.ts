// =============================================================================
// SISTEMA CENTRALIZADO DE PERMISOS
// =============================================================================
// Cada clave define un permiso y su valor es la lista de roles autorizados.
// Para modificar quién puede hacer qué, edita SOLO este archivo.
// =============================================================================

export const ROLES = [
    "DEV",
    "PRESIDENT",
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
    "event:create": ["DEV", "PRESIDENT", "DIRECTOR", "SUBDIRECTOR"],
    "event:manage": ["DEV", "PRESIDENT"], // Delete/update any event (creators can also manage their own)

    // --- Asistencia ---
    "attendance:take": ["DEV", "PRESIDENT", "DIRECTOR", "SUBDIRECTOR", "TREASURER"],
    "attendance:review": ["DEV", "PRESIDENT", "DIRECTOR", "SUBDIRECTOR"],

    // --- Calificaciones ---
    "grade:assign": ["DEV", "PRESIDENT", "DIRECTOR"],
    "grade:view_sheet": ["DEV", "PRESIDENT", "DIRECTOR", "SUBDIRECTOR"],

    // --- Pilares ---
    "pillar:manage": ["DEV", "PRESIDENT"],

    // --- Semestres / Ciclos ---
    "semester:manage": ["DEV", "PRESIDENT"],
    "semester:create_first": ["DEV", "PRESIDENT", "DIRECTOR", "SUBDIRECTOR", "TREASURER", "MEMBER", "VOLUNTEER"], // First-time setup

    // --- Usuarios ---
    "user:manage": ["DEV", "PRESIDENT"],

    // --- Áreas ---
    "area:manage": ["DEV", "PRESIDENT"],

    // --- Dashboard / Vistas ---
    "dashboard:area_comparison": ["DEV", "PRESIDENT", "DIRECTOR", "SUBDIRECTOR", "TREASURER"],
    "dashboard:leadership_view": ["DEV", "PRESIDENT", "DIRECTOR", "SUBDIRECTOR", "TREASURER"],

    // --- Admin panel access (route-level) ---
    "admin:access": ["DEV", "PRESIDENT", "DIRECTOR", "SUBDIRECTOR", "TREASURER"],
    "admin:full": ["DEV", "PRESIDENT"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verifica si un rol tiene un permiso específico.
 */
export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
    if (!role) return false;
    return (PERMISSIONS[permission] as readonly string[]).includes(role);
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
