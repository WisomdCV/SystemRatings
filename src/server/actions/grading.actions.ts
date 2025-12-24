"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { grades, gradeDefinitions, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { UpsertGradeDTO, UpsertGradeSchema } from "@/lib/validators/grading";
import { recalculateUserKPI } from "@/server/services/kpi.service";
import { revalidatePath } from "next/cache";

export async function upsertGradeAction(input: UpsertGradeDTO) {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };

        const currentRole = session.user.role || "";
        const canGrade = ["PRESIDENT", "DIRECTOR", "DEV"].includes(currentRole);

        if (!canGrade) {
            return { success: false, error: "No tienes permisos para calificar." };
        }

        // 1. Validate Input Structure
        const validated = UpsertGradeSchema.safeParse(input);
        if (!validated.success) {
            return { success: false, error: validated.error.issues[0].message };
        }

        const { targetUserId, definitionId, score, feedback } = validated.data;

        // 2. Fetch Pillar Definition to Check Max Score
        const pillar = await db.query.gradeDefinitions.findFirst({
            where: eq(gradeDefinitions.id, definitionId)
        });

        if (!pillar) return { success: false, error: "Pilar de evaluación no encontrado." };

        // 3. HARD VALIDATION: Score <= MaxScore
        const maxScore = pillar.maxScore || 5;
        if (score > maxScore) {
            return {
                success: false,
                error: `La nota ${score} excede el máximo permitido de ${maxScore} para ${pillar.name}.`
            };
        }

        // 4. Upsert Grade (Update if exists, Insert if new)
        // Check if grade exists
        const existingGrade = await db.query.grades.findFirst({
            where: and(
                eq(grades.userId, targetUserId),
                eq(grades.definitionId, definitionId)
            )
        });

        if (existingGrade) {
            await db.update(grades).set({
                score: score,
                feedback: feedback,
                assignedById: session.user.id
            }).where(eq(grades.id, existingGrade.id));
        } else {
            await db.insert(grades).values({
                userId: targetUserId,
                definitionId: definitionId,
                assignedById: session.user.id,
                score: score,
                feedback: feedback
            });
        }

        // 5. TRIGGER RECALCULATION
        await recalculateUserKPI(targetUserId, pillar.semesterId);

        revalidatePath("/dashboard/management/grades");
        return { success: true, message: "Nota guardada correctamente." };

    } catch (error: any) {
        console.error("Upsert Grade Error:", error);
        return { success: false, error: "Error al guardar la calificación." };
    }
}
