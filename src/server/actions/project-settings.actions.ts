"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { projectAreas, projectRoles, projectRolePermissions, projectMembers, projectInvitations } from "@/db/schema";
import { eq, asc, desc, isNull, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { PROJECT_PERMISSIONS, type ProjectPermission } from "@/lib/project-permissions";
import {
    CreateProjectAreaSchema, UpdateProjectAreaSchema,
    CreateProjectRoleSchema, UpdateProjectRoleSchema, UpdateRoleHierarchySchema,
    type CreateProjectAreaDTO, type UpdateProjectAreaDTO,
    type CreateProjectRoleDTO, type UpdateProjectRoleDTO, type UpdateRoleHierarchyDTO,
} from "@/lib/validators/project";

/** Validates if the user can manage admin roles/settings */
async function canManageProjectSettings() {
    const session = await auth();
    if (!session?.user) return false;
    return hasPermission(
        session.user.role,
        "admin:roles",
        session.user.customPermissions
    );
}

// ============================================================================
// PROJECT AREAS (Global)
// ============================================================================

export async function getProjectAreasAction() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };

        const areas = await db.query.projectAreas.findMany({
            orderBy: [asc(projectAreas.position)],
        });
        return { success: true as const, data: areas };
    } catch (error) {
        console.error("Error fetching project areas:", error);
        return { success: false as const, error: "Error al cargar las áreas de proyecto." };
    }
}

export async function createProjectAreaAction(input: CreateProjectAreaDTO) {
    try {
        if (!(await canManageProjectSettings())) return { success: false as const, error: "No autorizado." };

        const validated = CreateProjectAreaSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        const lastArea = await db.query.projectAreas.findFirst({ orderBy: [desc(projectAreas.position)] });
        const position = (lastArea?.position ?? 0) + 1;

        const [newArea] = await db.insert(projectAreas).values({
            name: validated.data.name.trim(),
            description: validated.data.description?.trim() || null,
            color: validated.data.color,
            position,
        }).returning();

        revalidatePath("/admin/project-settings");
        return { success: true as const, data: newArea, message: "Área creada exitosamente." };
    } catch (error) {
        console.error("Error creating project area:", error);
        return { success: false as const, error: "Error al crear el área. Quizás el nombre ya existe." };
    }
}

export async function updateProjectAreaAction(id: string, input: UpdateProjectAreaDTO) {
    try {
        if (!(await canManageProjectSettings())) return { success: false as const, error: "No autorizado." };

        const validated = UpdateProjectAreaSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        const existing = await db.query.projectAreas.findFirst({ where: eq(projectAreas.id, id) });
        if (!existing) return { success: false as const, error: "Área no encontrada." };

        await db.update(projectAreas).set({
            name: validated.data.name.trim(),
            description: validated.data.description?.trim() || null,
            color: validated.data.color,
        }).where(eq(projectAreas.id, id));

        revalidatePath("/admin/project-settings");
        return { success: true as const, message: "Área actualizada." };
    } catch (error) {
        console.error("Error updating project area:", error);
        return { success: false as const, error: "Error al actualizar el área." };
    }
}

export async function deleteProjectAreaAction(id: string) {
    try {
        if (!(await canManageProjectSettings())) return { success: false as const, error: "No autorizado." };

        const existing = await db.query.projectAreas.findFirst({ where: eq(projectAreas.id, id) });
        if (!existing) return { success: false as const, error: "Área no encontrada." };
        if (existing.isSystem) return { success: false as const, error: "Las áreas de sistema no se pueden eliminar." };

        await db.delete(projectAreas).where(eq(projectAreas.id, id));

        // Compact positions to eliminate gaps
        const remaining = await db.query.projectAreas.findMany({
            orderBy: [asc(projectAreas.position)],
            columns: { id: true },
        });
        for (let i = 0; i < remaining.length; i++) {
            await db.update(projectAreas).set({ position: i }).where(eq(projectAreas.id, remaining[i].id));
        }

        revalidatePath("/admin/project-settings");
        return { success: true as const, message: "Área eliminada exitosamente." };
    } catch (error) {
        console.error("Error deleting project area:", error);
        return { success: false as const, error: "Error al eliminar el área (puede estar en uso por un proyecto)." };
    }
}

export async function reorderProjectAreasAction(orderedIds: string[]) {
    try {
        if (!(await canManageProjectSettings())) return { success: false as const, error: "No autorizado." };

        for (let i = 0; i < orderedIds.length; i++) {
            await db.update(projectAreas)
                .set({ position: i })
                .where(eq(projectAreas.id, orderedIds[i]));
        }

        revalidatePath("/admin/project-settings");
        return { success: true as const, message: "Orden de áreas guardado." };
    } catch (error) {
        console.error("Error reordering project areas:", error);
        return { success: false as const, error: "Error al reordenar áreas." };
    }
}

// ============================================================================
// PROJECT ROLES (Global)
// ============================================================================

export async function getProjectRolesAction() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };

        const roles = await db.query.projectRoles.findMany({
            orderBy: [asc(projectRoles.displayOrder)],
            with: { permissions: true },
        });
        return { success: true as const, data: roles };
    } catch (error) {
        console.error("Error fetching project roles:", error);
        return { success: false as const, error: "Error al cargar los roles." };
    }
}

export async function createProjectRoleAction(input: CreateProjectRoleDTO) {
    try {
        if (!(await canManageProjectSettings())) return { success: false as const, error: "No autorizado." };

        const validated = CreateProjectRoleSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        // Auto calculate a hierarchy level: lowest existing - 10, minimum 1
        const roles = await db.query.projectRoles.findMany({ orderBy: [asc(projectRoles.hierarchyLevel)] });
        const lowestLevel = roles.length > 0 ? roles[0].hierarchyLevel : 100;
        const newLevel = Math.max(1, lowestLevel - 10);
        const highestDisplay = await db.query.projectRoles.findFirst({ orderBy: [desc(projectRoles.displayOrder)] });
        const newDisplayOrder = (highestDisplay?.displayOrder ?? -1) + 1;

        const result = await db.transaction(async (tx) => {
            const [newRole] = await tx.insert(projectRoles).values({
                name: validated.data.name.trim(),
                description: validated.data.description?.trim() || null,
                color: validated.data.color,
                hierarchyLevel: newLevel,
                displayOrder: newDisplayOrder,
            }).returning();

            // Insert permissions if provided
            const validPerms = (validated.data.permissions ?? []).filter(p =>
                (PROJECT_PERMISSIONS as readonly string[]).includes(p)
            );
            if (validPerms.length > 0) {
                await tx.insert(projectRolePermissions).values(
                    validPerms.map(p => ({ projectRoleId: newRole.id, permission: p }))
                );
            }

            return newRole;
        });

        revalidatePath("/admin/project-settings");
        return { success: true as const, data: result, message: "Rol creado exitosamente." };
    } catch (error) {
        console.error("Error creating project role:", error);
        return { success: false as const, error: "Error al crear el rol. Quizás el nombre ya existe." };
    }
}

export async function updateProjectRoleAction(id: string, input: UpdateProjectRoleDTO) {
    try {
        if (!(await canManageProjectSettings())) return { success: false as const, error: "No autorizado." };

        const validated = UpdateProjectRoleSchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        const existing = await db.query.projectRoles.findFirst({ where: eq(projectRoles.id, id) });
        if (!existing) return { success: false as const, error: "Rol no encontrado." };

        await db.transaction(async (tx) => {
            await tx.update(projectRoles).set({
                name: validated.data.name.trim(),
                description: validated.data.description?.trim() || null,
                color: validated.data.color,
                hierarchyLevel: validated.data.hierarchyLevel ?? existing.hierarchyLevel,
            }).where(eq(projectRoles.id, id));

            // Update permissions: delete all + re-insert (same pattern as IISE area permissions)
            if (validated.data.permissions !== undefined) {
                await tx.delete(projectRolePermissions).where(eq(projectRolePermissions.projectRoleId, id));
                const validPerms = validated.data.permissions.filter(p =>
                    (PROJECT_PERMISSIONS as readonly string[]).includes(p)
                );
                if (validPerms.length > 0) {
                    await tx.insert(projectRolePermissions).values(
                        validPerms.map(p => ({ projectRoleId: id, permission: p }))
                    );
                }
            }
        });

        revalidatePath("/admin/project-settings");
        return { success: true as const, message: "Rol actualizado." };
    } catch (error) {
        console.error("Error updating project role:", error);
        return { success: false as const, error: "Error al actualizar el rol." };
    }
}

export async function deleteProjectRoleAction(id: string) {
    try {
        if (!(await canManageProjectSettings())) return { success: false as const, error: "No autorizado." };

        const existing = await db.query.projectRoles.findFirst({ where: eq(projectRoles.id, id) });
        if (!existing) return { success: false as const, error: "Rol no encontrado." };
        if (existing.isSystem) return { success: false as const, error: "Los roles de sistema no se pueden eliminar." };

        // Pre-deletion check: projectRoleId is NOT NULL in members/invitations — cannot set null
        const membersWithRole = await db.query.projectMembers.findFirst({
            where: eq(projectMembers.projectRoleId, id),
            columns: { id: true },
        });
        if (membersWithRole) {
            return { success: false as const, error: "No se puede eliminar: hay miembros asignados a este rol. Reasígnalos primero." };
        }

        const invitationsWithRole = await db.query.projectInvitations.findFirst({
            where: and(
                eq(projectInvitations.projectRoleId, id),
                eq(projectInvitations.status, "PENDING"),
            ),
            columns: { id: true },
        });
        if (invitationsWithRole) {
            return { success: false as const, error: "No se puede eliminar: hay invitaciones pendientes con este rol. Cancélalas primero." };
        }

        await db.delete(projectRoles).where(eq(projectRoles.id, id));

        // Compact display order to eliminate gaps
        const remaining = await db.query.projectRoles.findMany({
            orderBy: [asc(projectRoles.displayOrder)],
            columns: { id: true },
        });
        for (let i = 0; i < remaining.length; i++) {
            await db.update(projectRoles).set({ displayOrder: i }).where(eq(projectRoles.id, remaining[i].id));
        }

        revalidatePath("/admin/project-settings");
        return { success: true as const, message: "Rol eliminado exitosamente." };
    } catch (error) {
        console.error("Error deleting project role:", error);
        return { success: false as const, error: "Error al eliminar el rol (puede estar en uso)." };
    }
}

/**
 * Reorders role cards visually without altering authority levels.
 */
export async function reorderProjectRolesAction(orderedIds: string[]) {
    try {
        if (!(await canManageProjectSettings())) return { success: false as const, error: "No autorizado." };

        for (let i = 0; i < orderedIds.length; i++) {
            await db.update(projectRoles)
                .set({ displayOrder: i })
                .where(eq(projectRoles.id, orderedIds[i]));
        }

        revalidatePath("/admin/project-settings");
        return { success: true as const, message: "Orden visual de roles actualizado." };
    } catch (error) {
        console.error("Error reordering project roles:", error);
        return { success: false as const, error: "Error al guardar el orden visual de roles." };
    }
}

/** Update only the authority level of a role (independent from visual order). */
export async function updateProjectRoleHierarchyAction(input: UpdateRoleHierarchyDTO) {
    try {
        if (!(await canManageProjectSettings())) {
            return { success: false as const, error: "No autorizado." };
        }

        const validated = UpdateRoleHierarchySchema.safeParse(input);
        if (!validated.success) return { success: false as const, error: validated.error.issues[0].message };

        const { roleId, hierarchyLevel } = validated.data;
        const existing = await db.query.projectRoles.findFirst({ where: eq(projectRoles.id, roleId) });
        if (!existing) return { success: false as const, error: "Rol no encontrado." };

        await db.update(projectRoles)
            .set({ hierarchyLevel })
            .where(eq(projectRoles.id, roleId));

        revalidatePath("/admin/project-settings");
        return { success: true as const, message: "Nivel de autoridad actualizado." };
    } catch (error) {
        console.error("Error updating role hierarchy:", error);
        return { success: false as const, error: "Error al actualizar el nivel de autoridad." };
    }
}

// ============================================================================
// PROJECT ROLE PERMISSIONS (Granular management)
// ============================================================================

/** Get permissions for a specific project role */
export async function getProjectRolePermissionsAction(roleId: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };

        const perms = await db.query.projectRolePermissions.findMany({
            where: eq(projectRolePermissions.projectRoleId, roleId),
        });
        return { success: true as const, data: perms.map(p => p.permission) };
    } catch (error) {
        console.error("Error fetching role permissions:", error);
        return { success: false as const, error: "Error al cargar permisos del rol." };
    }
}

/** Update permissions for a specific project role (delete + re-insert) */
export async function updateProjectRolePermissionsAction(roleId: string, permissions: string[]) {
    try {
        if (!(await canManageProjectSettings())) return { success: false as const, error: "No autorizado." };

        const existing = await db.query.projectRoles.findFirst({ where: eq(projectRoles.id, roleId) });
        if (!existing) return { success: false as const, error: "Rol no encontrado." };

        const validPerms = permissions.filter(p =>
            (PROJECT_PERMISSIONS as readonly string[]).includes(p)
        );

        await db.transaction(async (tx) => {
            await tx.delete(projectRolePermissions).where(eq(projectRolePermissions.projectRoleId, roleId));
            if (validPerms.length > 0) {
                await tx.insert(projectRolePermissions).values(
                    validPerms.map(p => ({ projectRoleId: roleId, permission: p }))
                );
            }
        });

        revalidatePath("/admin/project-settings");
        return { success: true as const, message: "Permisos actualizados." };
    } catch (error) {
        console.error("Error updating role permissions:", error);
        return { success: false as const, error: "Error al actualizar permisos." };
    }
}

/** Get the list of all available project permissions (for admin UI) */
export async function getAvailableProjectPermissionsAction() {
    return { success: true as const, data: [...PROJECT_PERMISSIONS] };
}
