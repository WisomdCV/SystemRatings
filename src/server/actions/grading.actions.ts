"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { grades, gradeDefinitions, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { UpsertGradeDTO, UpsertGradeSchema } from "@/lib/validators/grading";
import { recalculateUserKPI } from "@/server/services/kpi.service";
import { recalculateAreaKPIForUser } from "@/server/services/area-kpi.service";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";

export async function upsertGradeAction(input: UpsertGradeDTO) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };

        const currentRole = session.user.role || "";
        const canAssignOwnArea = hasPermission(currentRole, "grade:assign_own_area", session.user.customPermissions);
        const canAssignAll = hasPermission(currentRole, "grade:assign_all", session.user.customPermissions);

        if (!canAssignOwnArea && !canAssignAll) {
            return { success: false, error: "No tienes permisos para calificar." };
        }

        // 1. Validate Input Structure
        const validated = UpsertGradeSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: validated.error.issues[0].message };
        }

        const { targetUserId, definitionId, score, feedback } = validated.data;

        // 2. Validate target user scope and DEV exclusion
        const targetUser = await db.query.users.findFirst({
            where: eq(users.id, targetUserId),
            columns: {
                role: true,
                currentAreaId: true,
            },
        });

        if (!targetUser) {
            return { success: false, error: "Usuario objetivo no encontrado." };
        }

        if (targetUser.role === "DEV") {
            return { success: false, error: "No se puede calificar a usuarios DEV." };
        }

        if (!canAssignAll) {
            if (!session.user.currentAreaId) {
                return { success: false, error: "No tienes un área asignada para calificar." };
            }

            if (targetUser.currentAreaId !== session.user.currentAreaId) {
                return { success: false, error: "Solo puedes calificar miembros de tu área." };
            }
        }

        // 3. Fetch pillar definition to check max score
        const pillar = await db.query.gradeDefinitions.findFirst({
            where: eq(gradeDefinitions.id, definitionId)
        });

        if (!pillar) return { success: false, error: "Pilar de evaluación no encontrado." };

        // 4. HARD VALIDATION: Score <= MaxScore
        const maxScore = pillar.maxScore || 5;
        if (score > maxScore) {
            return {
                success: false,
                error: `La nota ${score} excede el máximo permitido de ${maxScore} para ${pillar.name}.`
            };
        }

        // 5. Upsert Grade atomically (prevents race condition on concurrent grading)
        await db.transaction(async (tx) => {
            const existingGrade = await tx.query.grades.findFirst({
                where: and(
                    eq(grades.userId, targetUserId),
                    eq(grades.definitionId, definitionId)
                )
            });

            if (existingGrade) {
                await tx.update(grades).set({
                    score: score,
                    feedback: feedback,
                    assignedById: session.user.id
                }).where(eq(grades.id, existingGrade.id));
            } else {
                await tx.insert(grades).values({
                    userId: targetUserId,
                    definitionId: definitionId,
                    assignedById: session.user.id,
                    score: score,
                    feedback: feedback
                });
            }
        });

        // 6. TRIGGER USER KPI RECALCULATION
        const newKpi = await recalculateUserKPI(targetUserId, pillar.semesterId);

        // 7. TRIGGER AREA KPI RECALCULATION (non-blocking, wrapped in try-catch)
        try {
            const now = new Date();
            await recalculateAreaKPIForUser(
                targetUserId,
                pillar.semesterId,
                now.getMonth() + 1,
                now.getFullYear()
            );
        } catch (areaError) {
            console.error("Error calculating area KPI (non-critical):", areaError);
            // Don't fail the main operation
        }

        revalidatePath("/dashboard/management/grades");
        revalidatePath("/dashboard/areas");
        return { success: true, message: "Nota guardada correctamente.", newKpi };

    } catch (error: any) {
        console.error("Upsert Grade Error:", error);
        return { success: false, error: "Error al guardar la calificación." };
    }
}

