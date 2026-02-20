"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { areas, semesterAreas, semesters, users } from "@/db/schema";
import { eq, and, asc, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

// --- Validators ---
export const CreateAreaSchema = z.object({
    name: z.string().min(2, "Nombre muy corto").max(100),
    code: z.string().min(1).max(10).toUpperCase().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
});

export const UpdateAreaSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(2, "Nombre muy corto").max(100),
    code: z.string().min(1).max(10).toUpperCase().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
});

// --- Actions ---

/** Get all global areas */
export async function getAllAreasAction() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };

        const allAreas = await db.query.areas.findMany({
            orderBy: [asc(areas.name)],
        });

        return { success: true as const, data: allAreas };
    } catch (error) {
        console.error("Error getting areas:", error);
        return { success: false as const, error: "Error al cargar áreas" };
    }
}

/** Get areas with their semester activation status */
export async function getAreasWithSemesterStatusAction(semesterId: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };

        // Get all areas
        const allAreas = await db.query.areas.findMany({
            orderBy: [asc(areas.name)],
        });

        // Get semester_area records for this semester
        const semAreas = await db.query.semesterAreas.findMany({
            where: eq(semesterAreas.semesterId, semesterId),
        });

        // Build map: areaId -> isActive
        const activationMap = new Map(semAreas.map(sa => [sa.areaId, sa.isActive]));

        const result = allAreas.map(area => ({
            ...area,
            isActiveInSemester: activationMap.get(area.id) ?? false,
            semesterAreaId: semAreas.find(sa => sa.areaId === area.id)?.id ?? null,
        }));

        return { success: true as const, data: result };
    } catch (error) {
        console.error("Error getting areas with semester status:", error);
        return { success: false as const, error: "Error al cargar áreas del ciclo" };
    }
}

/** Create a new global area */
export async function createAreaAction(input: z.infer<typeof CreateAreaSchema>) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };
        if (!hasPermission(session.user.role, "area:manage")) {
            return { success: false as const, error: "No tienes permisos para gestionar áreas." };
        }

        const validated = CreateAreaSchema.safeParse(input);
        if (!validated.success) {
            return { success: false as const, error: validated.error.issues[0].message };
        }

        const [newArea] = await db.insert(areas).values({
            name: validated.data.name,
            code: validated.data.code || null,
            description: validated.data.description || null,
        }).returning();

        revalidatePath("/admin/areas");
        return { success: true as const, data: newArea, message: "Área creada exitosamente." };
    } catch (error: any) {
        if (error.message?.includes("UNIQUE")) {
            return { success: false as const, error: "Ya existe un área con ese código." };
        }
        console.error("Error creating area:", error);
        return { success: false as const, error: "Error al crear el área." };
    }
}

/** Update a global area */
export async function updateAreaAction(input: z.infer<typeof UpdateAreaSchema>) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };
        if (!hasPermission(session.user.role, "area:manage")) {
            return { success: false as const, error: "No tienes permisos." };
        }

        const validated = UpdateAreaSchema.safeParse(input);
        if (!validated.success) {
            return { success: false as const, error: validated.error.issues[0].message };
        }

        await db.update(areas).set({
            name: validated.data.name,
            code: validated.data.code || null,
            description: validated.data.description || null,
        }).where(eq(areas.id, validated.data.id));

        revalidatePath("/admin/areas");
        return { success: true as const, message: "Área actualizada." };
    } catch (error: any) {
        if (error.message?.includes("UNIQUE")) {
            return { success: false as const, error: "Ya existe un área con ese código." };
        }
        console.error("Error updating area:", error);
        return { success: false as const, error: "Error al actualizar el área." };
    }
}

/** Delete a global area (only if no users are assigned) */
export async function deleteAreaAction(id: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };
        if (!hasPermission(session.user.role, "area:manage")) {
            return { success: false as const, error: "No tienes permisos." };
        }

        // Check for assigned users
        const assignedUsers = await db.query.users.findFirst({
            where: eq(users.currentAreaId, id),
        });

        if (assignedUsers) {
            return {
                success: false as const,
                error: "No se puede eliminar: hay usuarios asignados a esta área. Reasígnalos primero."
            };
        }

        await db.delete(areas).where(eq(areas.id, id));
        revalidatePath("/admin/areas");
        return { success: true as const, message: "Área eliminada." };
    } catch (error) {
        console.error("Error deleting area:", error);
        return { success: false as const, error: "Error al eliminar el área." };
    }
}

/** Toggle area activation for a specific semester */
export async function toggleAreaInSemesterAction(areaId: string, semesterId: string, activate: boolean) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };
        if (!hasPermission(session.user.role, "area:manage")) {
            return { success: false as const, error: "No tienes permisos." };
        }

        // Check if record exists
        const existing = await db.query.semesterAreas.findFirst({
            where: and(
                eq(semesterAreas.semesterId, semesterId),
                eq(semesterAreas.areaId, areaId),
            ),
        });

        if (existing) {
            // Update
            await db.update(semesterAreas)
                .set({ isActive: activate })
                .where(eq(semesterAreas.id, existing.id));
        } else {
            // Insert
            await db.insert(semesterAreas).values({
                semesterId,
                areaId,
                isActive: activate,
            });
        }

        revalidatePath("/admin/areas");
        return {
            success: true as const,
            message: activate ? "Área activada en el ciclo." : "Área desactivada del ciclo."
        };
    } catch (error) {
        console.error("Error toggling area in semester:", error);
        return { success: false as const, error: "Error al cambiar estado del área." };
    }
}

/** Bulk activate all areas for a semester */
export async function activateAllAreasInSemesterAction(semesterId: string) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };
        if (!hasPermission(session.user.role, "area:manage")) {
            return { success: false as const, error: "No tienes permisos." };
        }

        const allAreas = await db.query.areas.findMany();

        for (const area of allAreas) {
            const existing = await db.query.semesterAreas.findFirst({
                where: and(
                    eq(semesterAreas.semesterId, semesterId),
                    eq(semesterAreas.areaId, area.id),
                ),
            });

            if (existing) {
                await db.update(semesterAreas)
                    .set({ isActive: true })
                    .where(eq(semesterAreas.id, existing.id));
            } else {
                await db.insert(semesterAreas).values({
                    semesterId,
                    areaId: area.id,
                    isActive: true,
                });
            }
        }

        revalidatePath("/admin/areas");
        return { success: true as const, message: `${allAreas.length} áreas activadas.` };
    } catch (error) {
        console.error("Error activating all areas:", error);
        return { success: false as const, error: "Error al activar áreas." };
    }
}

/** Get all areas with their current Director and Subdirector */
export async function getAreasWithLeadersAction() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };
        if (!hasPermission(session.user.role, "area:manage")) {
            return { success: false as const, error: "No tienes permisos." };
        }

        const allAreas = await db.query.areas.findMany({
            orderBy: [asc(areas.name)],
        });

        // Get all users who are DIRECTOR or SUBDIRECTOR
        const leaders = await db.query.users.findMany({
            where: and(
                inArray(users.role, ["DIRECTOR", "SUBDIRECTOR"]),
                eq(users.status, "ACTIVE"),
            ),
            columns: {
                id: true,
                name: true,
                email: true,
                role: true,
                currentAreaId: true,
                image: true,
            },
        });

        const result = allAreas.map(area => ({
            ...area,
            director: leaders.find(l => l.currentAreaId === area.id && l.role === "DIRECTOR") || null,
            subdirector: leaders.find(l => l.currentAreaId === area.id && l.role === "SUBDIRECTOR") || null,
        }));

        return { success: true as const, data: result };
    } catch (error) {
        console.error("Error getting areas with leaders:", error);
        return { success: false as const, error: "Error al cargar directorio." };
    }
}

/** Get active users eligible for Director/Subdirector assignment */
export async function getMembersForAssignmentAction() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false as const, error: "No autorizado" };
        if (!hasPermission(session.user.role, "area:manage")) {
            return { success: false as const, error: "No tienes permisos." };
        }

        const activeUsers = await db.query.users.findMany({
            where: and(
                eq(users.status, "ACTIVE"),
                ne(users.role, "DEV"),
            ),
            columns: {
                id: true,
                name: true,
                email: true,
                role: true,
                currentAreaId: true,
                image: true,
            },
            orderBy: [asc(users.name)],
        });

        return { success: true as const, data: activeUsers };
    } catch (error) {
        console.error("Error getting members:", error);
        return { success: false as const, error: "Error al cargar miembros." };
    }
}
