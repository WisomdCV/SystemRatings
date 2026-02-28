"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { projectAreas, projectRoles } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** Validates if the user is a system admin */
async function isAdminUser() {
    const session = await auth();
    return session?.user?.role === "DEV" || session?.user?.role === "PRESIDENT";
}

// ============================================================================
// PROJECT AREAS (Global)
// ============================================================================

export async function getProjectAreasAction() {
    try {
        const areas = await db.query.projectAreas.findMany({
            orderBy: [asc(projectAreas.position)],
        });
        return { success: true as const, data: areas };
    } catch (error) {
        console.error("Error fetching project areas:", error);
        return { success: false as const, error: "Error al cargar las áreas de proyecto." };
    }
}

export async function createProjectAreaAction(data: { name: string; description?: string; color: string }) {
    try {
        if (!(await isAdminUser())) return { success: false as const, error: "No autorizado." };
        if (!data.name.trim()) return { success: false as const, error: "El nombre es obligatorio." };

        const lastArea = await db.query.projectAreas.findFirst({ orderBy: [desc(projectAreas.position)] });
        const position = (lastArea?.position ?? 0) + 1;

        const [newArea] = await db.insert(projectAreas).values({
            name: data.name.trim(),
            description: data.description?.trim() || null,
            color: data.color,
            position,
        }).returning();

        revalidatePath("/admin/project-settings");
        return { success: true as const, data: newArea, message: "Área creada exitosamente." };
    } catch (error) {
        console.error("Error creating project area:", error);
        return { success: false as const, error: "Error al crear el área. Quizás el nombre ya existe." };
    }
}

export async function updateProjectAreaAction(id: string, data: { name: string; description?: string; color: string; membersCanCreateEvents?: boolean }) {
    try {
        if (!(await isAdminUser())) return { success: false as const, error: "No autorizado." };
        if (!data.name.trim()) return { success: false as const, error: "El nombre es obligatorio." };

        // check if system area
        const existing = await db.query.projectAreas.findFirst({ where: eq(projectAreas.id, id) });
        if (!existing) return { success: false as const, error: "Área no encontrada." };

        await db.update(projectAreas).set({
            name: data.name.trim(),
            description: data.description?.trim() || null,
            color: data.color,
            membersCanCreateEvents: data.membersCanCreateEvents ?? false,
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
        if (!(await isAdminUser())) return { success: false as const, error: "No autorizado." };

        const existing = await db.query.projectAreas.findFirst({ where: eq(projectAreas.id, id) });
        if (!existing) return { success: false as const, error: "Área no encontrada." };
        if (existing.isSystem) return { success: false as const, error: "Las áreas de sistema no se pueden eliminar." };

        await db.delete(projectAreas).where(eq(projectAreas.id, id));
        revalidatePath("/admin/project-settings");
        return { success: true as const, message: "Área eliminada exitosamente." };
    } catch (error) {
        console.error("Error deleting project area:", error);
        return { success: false as const, error: "Error al eliminar el área (puede estar en uso por un proyecto)." };
    }
}

export async function reorderProjectAreasAction(orderedIds: string[]) {
    try {
        if (!(await isAdminUser())) return { success: false as const, error: "No autorizado." };

        // Fast batch-like update via loop
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
        // We order by hierarchy level descending by default so highest role is first
        const roles = await db.query.projectRoles.findMany({
            orderBy: [desc(projectRoles.hierarchyLevel)],
        });
        return { success: true as const, data: roles };
    } catch (error) {
        console.error("Error fetching project roles:", error);
        return { success: false as const, error: "Error al cargar los roles." };
    }
}

export async function createProjectRoleAction(data: { name: string; description?: string; color: string }) {
    try {
        if (!(await isAdminUser())) return { success: false as const, error: "No autorizado." };
        if (!data.name.trim()) return { success: false as const, error: "El nombre es obligatorio." };

        // Auto calculate a hierarchy level: lowest existing - 10, minimum 0
        const roles = await db.query.projectRoles.findMany({ orderBy: [asc(projectRoles.hierarchyLevel)] });
        const lowestLevel = roles.length > 0 ? roles[0].hierarchyLevel : 100;
        let newLevel = Math.max(0, lowestLevel - 10);

        const [newRole] = await db.insert(projectRoles).values({
            name: data.name.trim(),
            description: data.description?.trim() || null,
            color: data.color,
            hierarchyLevel: newLevel,
        }).returning();

        revalidatePath("/admin/project-settings");
        return { success: true as const, data: newRole, message: "Rol creado exitosamente." };
    } catch (error) {
        console.error("Error creating project role:", error);
        return { success: false as const, error: "Error al crear el rol. Quizás el nombre ya existe." };
    }
}

export async function updateProjectRoleAction(id: string, data: { name: string; description?: string; color: string; canCreateEvents?: boolean }) {
    try {
        if (!(await isAdminUser())) return { success: false as const, error: "No autorizado." };
        if (!data.name.trim()) return { success: false as const, error: "El nombre es obligatorio." };

        const existing = await db.query.projectRoles.findFirst({ where: eq(projectRoles.id, id) });
        if (!existing) return { success: false as const, error: "Rol no encontrado." };

        await db.update(projectRoles).set({
            name: data.name.trim(),
            description: data.description?.trim() || null,
            color: data.color,
            canCreateEvents: data.canCreateEvents ?? false,
        }).where(eq(projectRoles.id, id));

        revalidatePath("/admin/project-settings");
        return { success: true as const, message: "Rol actualizado." };
    } catch (error) {
        console.error("Error updating project role:", error);
        return { success: false as const, error: "Error al actualizar el rol." };
    }
}

export async function deleteProjectRoleAction(id: string) {
    try {
        if (!(await isAdminUser())) return { success: false as const, error: "No autorizado." };

        const existing = await db.query.projectRoles.findFirst({ where: eq(projectRoles.id, id) });
        if (!existing) return { success: false as const, error: "Rol no encontrado." };
        if (existing.isSystem) return { success: false as const, error: "Los roles de sistema no se pueden eliminar." };

        await db.delete(projectRoles).where(eq(projectRoles.id, id));
        revalidatePath("/admin/project-settings");
        return { success: true as const, message: "Rol eliminado exitosamente." };
    } catch (error) {
        console.error("Error deleting project role:", error);
        return { success: false as const, error: "Error al eliminar el rol (puede estar en uso)." };
    }
}

/** 
 * Reorders visually but translates the order into mathematical hierarchyLevels.
 * Highest item (first in array) gets `length * 10`, lowest gets `10`.
 */
export async function reorderProjectRolesAction(orderedIds: string[]) {
    try {
        if (!(await isAdminUser())) return { success: false as const, error: "No autorizado." };

        const total = orderedIds.length;
        for (let i = 0; i < total; i++) {
            // first item is most powerful. Mathematical logic:
            // e.g. i=0 -> level 100. i=1 -> level 90. i=2 -> level 80...
            const newHierarchyLevel = Math.max(10, 100 - (i * 10));

            await db.update(projectRoles)
                .set({ hierarchyLevel: newHierarchyLevel })
                .where(eq(projectRoles.id, orderedIds[i]));
        }

        revalidatePath("/admin/project-settings");
        return { success: true as const, message: "Jerarquías actualizadas correctamente." };
    } catch (error) {
        console.error("Error reordering project roles:", error);
        return { success: false as const, error: "Error al guardar jerarquías." };
    }
}
