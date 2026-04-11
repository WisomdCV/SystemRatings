"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { grades, gradeDefinitions, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { UpsertGradeDTO, UpsertGradeSchema } from "@/lib/validators/grading";
import { recalculateUserKPI } from "@/server/services/kpi.service";
import { recalculateAreaKPIForUser } from "@/server/services/area-kpi.service";
import { revalidatePath } from "next/cache";
import { canGradePillarForUser, type GraderContext } from "@/server/services/grading-permissions.service";

export async function upsertGradeAction(input: UpsertGradeDTO) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };

        // 1. Validate Input Structure
        const validated = UpsertGradeSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: validated.error.issues[0].message };
        }

        const { targetUserId, definitionId, score, feedback } = validated.data;

        // 2. Fetch pillar definition
        const pillar = await db.query.gradeDefinitions.findFirst({
            where: eq(gradeDefinitions.id, definitionId)
        });

        if (!pillar) return { success: false, error: "Pilar de evaluación no encontrado." };

        // 3. Fetch target user
        const targetUser = await db.query.users.findFirst({
            where: eq(users.id, targetUserId),
            columns: { role: true, currentAreaId: true },
        });

        if (!targetUser) return { success: false, error: "Usuario objetivo no encontrado." };

        if (targetUser.role === "DEV") {
            return { success: false, error: "No se puede calificar a usuarios DEV." };
        }

        // 4. isDirectorOnly server-side enforcement
        if (pillar.isDirectorOnly) {
            const directorLevelRoles = ["DIRECTOR", "SUBDIRECTOR", "PRESIDENT", "VICEPRESIDENT", "SECRETARY", "TREASURER"];
            if (!targetUser.role || !directorLevelRoles.includes(targetUser.role)) {
                return { success: false, error: `El pilar "${pillar.name}" solo aplica a roles directivos.` };
            }
        }

        // 5. Permission check via canGradePillarForUser (flexible, DB-driven)
        const graderCtx: GraderContext = {
            userId: session.user.id,
            userRole: session.user.role || "",
            userAreaId: session.user.currentAreaId,
            customPermissions: session.user.customPermissions,
        };

        const canGrade = await canGradePillarForUser(graderCtx, definitionId, targetUser.currentAreaId);

        if (!canGrade) {
            return { success: false, error: "No tienes permisos para calificar este pilar para este usuario." };
        }

        // 6. HARD VALIDATION: Score <= MaxScore
        const maxScore = pillar.maxScore || 5;
        if (score > maxScore) {
            return {
                success: false,
                error: `La nota ${score} excede el máximo permitido de ${maxScore} para ${pillar.name}.`
            };
        }

        // 7. Upsert Grade atomically
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

        // 8. TRIGGER USER KPI RECALCULATION
        const newKpi = await recalculateUserKPI(targetUserId, pillar.semesterId);

        // 9. TRIGGER AREA KPI RECALCULATION (non-blocking)
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
        }

        revalidatePath("/dashboard/management/grades");
        revalidatePath("/dashboard/areas");
        return { success: true, message: "Nota guardada correctamente.", newKpi };

    } catch (error: any) {
        console.error("Upsert Grade Error:", error);
        return { success: false, error: "Error al guardar la calificación." };
    }
}
