import { z } from "zod";

// --- Enums Reuse ---
export const ROLES = [
    "VOLUNTEER",
    "MEMBER",
    "DIRECTOR",
    "SUBDIRECTOR",
    "PRESIDENT",
    "TREASURER",
    "DEV",
] as const;

export const CATEGORIES = ["TRAINEE", "JUNIOR", "SENIOR", "MASTER"] as const;
export const STATUSES = ["ACTIVE", "BANNED", "SUSPENDED", "WARNED"] as const;

// 1. DTO para Ascensos/Traslados (Funcionalidad 2)
export const UpdateUserRoleSchema = z.object({
    userId: z.string().uuid(),
    role: z.enum(ROLES),
    areaId: z.string().uuid().nullable().optional(), // Nullable allowed for non-area roles
    reason: z.string().optional(), // For history/logging
});

// 2. DTO para Datos Administrativos (Funcionalidad 3)
export const UpdateUserProfileSchema = z.object({
    userId: z.string().uuid(),
    cui: z.string().max(8).optional(),
    phone: z.string().optional(),
    category: z.enum(CATEGORIES),
});

// 3. DTO para Moderación (Funcionalidad 4)
export const ModerateUserSchema = z.object({
    userId: z.string().uuid(),
    status: z.enum(STATUSES),
    moderationReason: z.string().min(5, "Debes especificar una razón de moderación"),
    suspendedUntil: z.date().optional(), // New field
});

// Types export
export type UpdateUserRoleDTO = z.infer<typeof UpdateUserRoleSchema>;
export type UpdateUserProfileDTO = z.infer<typeof UpdateUserProfileSchema>;
export type ModerateUserDTO = z.infer<typeof ModerateUserSchema>;
