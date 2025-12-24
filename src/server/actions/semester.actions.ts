"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { semesters } from "@/db/schema";
import { CreateSemesterDTO, CreateSemesterSchema } from "@/lib/validators/semester";
import { eq, desc, ne, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// 1. Get All Semesters
export async function getAllSemestersAction() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };

        const allSemesters = await db.query.semesters.findMany({
            orderBy: [desc(semesters.startDate)],
        });

        return { success: true, data: allSemesters };
    } catch (error) {
        console.error("Error fetching semesters:", error);
        return { success: false, error: "Error al cargar ciclos" };
    }
}

// 2. Create Semester
export async function createSemesterAction(input: CreateSemesterDTO) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };

        // Permission Check (Only President/Dev)
        const role = session.user.role;
        if (!["PRESIDENT", "DEV"].includes(role || "")) {
            return { success: false, error: "No tienes permisos para crear ciclos." };
        }

        // Validate Input
        const validated = CreateSemesterSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: validated.error.issues[0].message };
        }

        // Check Unique Name
        const existing = await db.query.semesters.findFirst({
            where: eq(semesters.name, validated.data.name)
        });
        if (existing) {
            return { success: false, error: "Ya existe un ciclo con ese nombre." };
        }

        // Insert (Inactive by default)
        await db.insert(semesters).values({
            name: validated.data.name,
            startDate: validated.data.startDate,
            endDate: validated.data.endDate || null,
            isActive: false // Always created inactive for safety
        });

        revalidatePath("/admin/cycles");
        return { success: true, message: "Ciclo creado correctamente (Inactivo)." };

    } catch (error: any) {
        console.error("Create Semester Error:", error);
        return { success: false, error: error.message || "Error al crear ciclo" };
    }
}

// 3. Toggle Active Status (The Critical Logic)
export async function toggleSemesterStatusAction(semesterId: string, shouldActivate: boolean) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };

        const role = session.user.role;
        if (!["PRESIDENT", "DEV"].includes(role || "")) {
            return { success: false, error: "No tienes permisos de gestión." };
        }

        if (shouldActivate) {
            // TRANSACTION: Activate Target AND Deactivate Others
            await db.transaction(async (tx) => {
                // 1. Deactivate ALL other semesters
                await tx.update(semesters)
                    .set({ isActive: false })
                    .where(ne(semesters.id, semesterId));

                // 2. Activate target
                await tx.update(semesters)
                    .set({ isActive: true })
                    .where(eq(semesters.id, semesterId));
            });
            revalidatePath("/admin/events"); // Events depend on active semester
            revalidatePath("/dashboard");
        } else {
            // Simply Deactivate Target (Result: No active semester)
            // This allows a "maintenance mode" where nothing is active.
            await db.update(semesters)
                .set({ isActive: false })
                .where(eq(semesters.id, semesterId));
        }

        revalidatePath("/admin/cycles");
        return { success: true, message: shouldActivate ? "Ciclo activado exitosamente." : "Ciclo cerrado." };

    } catch (error: any) {
        console.error("Toggle Semester Error:", error);
        return { success: false, error: error.message || "Error al cambiar estado" };
    }
}
