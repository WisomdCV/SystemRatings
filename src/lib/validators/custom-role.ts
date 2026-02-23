import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";

// Available permission keys for validation
const AVAILABLE_PERMISSIONS = Object.keys(PERMISSIONS) as [string, ...string[]];

// ─── Custom Role Schemas ─────────────────────────────────────────────────────

export const CreateCustomRoleSchema = z.object({
    name: z.string().min(2, "Nombre muy corto").max(50, "Nombre muy largo"),
    description: z.string().max(200).optional().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (formato: #RRGGBB)").default("#6366f1"),
    position: z.number().int().min(0).max(100).default(0),
    permissions: z.array(z.enum(AVAILABLE_PERMISSIONS)).min(1, "Debe tener al menos un permiso"),
});

export const UpdateCustomRoleSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(2, "Nombre muy corto").max(50, "Nombre muy largo"),
    description: z.string().max(200).optional().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido").default("#6366f1"),
    position: z.number().int().min(0).max(100).default(0),
    permissions: z.array(z.enum(AVAILABLE_PERMISSIONS)).min(1, "Debe tener al menos un permiso"),
});

export const AssignCustomRoleSchema = z.object({
    userId: z.string(),
    customRoleId: z.string(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreateCustomRoleDTO = z.infer<typeof CreateCustomRoleSchema>;
export type UpdateCustomRoleDTO = z.infer<typeof UpdateCustomRoleSchema>;
export type AssignCustomRoleDTO = z.infer<typeof AssignCustomRoleSchema>;
