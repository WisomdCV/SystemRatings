"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { semesters, users, positionHistory } from "@/db/schema";
import { CreateSemesterDTO, CreateSemesterSchema } from "@/lib/validators/semester";
import { eq, desc, ne, and, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";

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

        const role = session.user.role;

        // Check if this is the first semester (special case: anyone can create)
        const existingSemesters = await db.query.semesters.findFirst();
        const isFirstSemester = !existingSemesters;

        // Permission Check: Only President/Dev OR first-time setup
        if (!isFirstSemester && !hasPermission(role, "semester:manage", session.user.customPermissions)) {
            return { success: false, error: "No tienes permisos para crear ciclos." };
        }

        // Validate Input
        const validated = CreateSemesterSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: validated.error.issues[0].message };
        }

        const { activateImmediately, ...semesterData } = validated.data;

        // Check Unique Name
        const existing = await db.query.semesters.findFirst({
            where: eq(semesters.name, semesterData.name)
        });
        if (existing) {
            return { success: false, error: "Ya existe un ciclo con ese nombre." };
        }

        // Insert Semester
        const [newSemester] = await db.insert(semesters).values({
            name: semesterData.name,
            startDate: semesterData.startDate,
            endDate: semesterData.endDate || null,
            isActive: activateImmediately || false
        }).returning();

        // If activating immediately, deactivate others
        if (activateImmediately && newSemester) {
            await db.update(semesters)
                .set({ isActive: false })
                .where(ne(semesters.id, newSemester.id));
        }

        revalidatePath("/admin/cycles");
        revalidatePath("/dashboard");
        revalidatePath("/setup");

        const message = activateImmediately
            ? "Ciclo creado y activado correctamente."
            : "Ciclo creado correctamente (Inactivo).";

        return { success: true, message };

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
        if (!hasPermission(role, "semester:manage", session.user.customPermissions)) {
            return { success: false, error: "No tienes permisos de gestión." };
        }

        if (shouldActivate) {
            // TRANSACTION: Activate Target AND Deactivate Others
            await db.transaction(async (tx) => {
                // 1. Find currently active semesters to close their leaders' histories
                const activeCycles = await tx.select({ id: semesters.id }).from(semesters).where(eq(semesters.isActive, true));

                if (activeCycles.length > 0) {
                    await triggerMassDowngrade(tx);
                }

                // 2. Deactivate ALL other semesters
                await tx.update(semesters)
                    .set({ isActive: false })
                    .where(ne(semesters.id, semesterId));

                // 3. Activate target
                await tx.update(semesters)
                    .set({ isActive: true })
                    .where(eq(semesters.id, semesterId));
            });
            revalidatePath("/admin/events"); // Events depend on active semester
            revalidatePath("/dashboard");
        } else {
            // Deactivate Target AND trigger downgrade
            await db.transaction(async (tx) => {
                await triggerMassDowngrade(tx);

                await tx.update(semesters)
                    .set({ isActive: false })
                    .where(eq(semesters.id, semesterId));
            });
        }

        revalidatePath("/admin/cycles");
        return { success: true, message: shouldActivate ? "Ciclo activado exitosamente." : "Ciclo cerrado." };

    } catch (error: any) {
        console.error("Toggle Semester Error:", error);
        return { success: false, error: error.message || "Error al cambiar estado" };
    }
}

// --- Internal Helpers ---
async function triggerMassDowngrade(tx: any) {
    // 1. Find all users who are currently DIRECTORS, SUBDIRECTORS, or TREASURERS
    const leaders = await tx.query.users.findMany({
        where: and(
            eq(users.status, "ACTIVE"),
            // Downgrade all leaders. Although VP, SEC, and TREASURER have President-level permissions, they're cycle-bound leaders.
            inArray(users.role, ["VICEPRESIDENT", "SECRETARY", "DIRECTOR", "SUBDIRECTOR", "TREASURER"])
        ),
        columns: { id: true }
    });

    if (leaders.length > 0) {
        const leaderIds = leaders.map((u: any) => u.id);

        // 2. Close their open position history (set endDate to NOW)
        await tx.update(positionHistory)
            .set({ endDate: new Date() })
            .where(and(
                inArray(positionHistory.userId, leaderIds),
                isNull(positionHistory.endDate)
            ));

        // 3. Downgrade their primary role to MEMBER
        // currentAreaId remains untouched so they stay in their area!
        await tx.update(users)
            .set({ role: "MEMBER" })
            .where(inArray(users.id, leaderIds));
    }
}
