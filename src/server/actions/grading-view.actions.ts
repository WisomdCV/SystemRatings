"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { users, gradeDefinitions, grades, semesters, kpiMonthlySummaries } from "@/db/schema";
import { eq, and, ne, asc, inArray } from "drizzle-orm";
import { resolveAllPillarPermissions, type GraderContext, type GradingScope } from "@/server/services/grading-permissions.service";

export async function getGradingSheetAction() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };

        const role = session.user.role || "";
        const currentAreaId = session.user.currentAreaId;
        const userId = session.user.id;
        const canViewOwnArea = hasPermission(role, "grade:view_own_area", session.user.customPermissions);
        const canViewAll = hasPermission(role, "grade:view_all", session.user.customPermissions);

        if (!canViewOwnArea && !canViewAll) {
            return { success: false, error: "No tienes permisos para ver calificaciones." };
        }

        if (!canViewAll && !currentAreaId) {
            return { success: false, error: "No tienes un área asignada para calificar." };
        }

        // 1. Get Active Semester
        const activeSemester = await db.query.semesters.findFirst({
            where: eq(semesters.isActive, true)
        });

        if (!activeSemester) {
            return { success: false, error: "No hay un ciclo activo en este momento." };
        }

        // 2. Get Grade Definitions (Pillars) for this Semester
        const pillars = await db.query.gradeDefinitions.findMany({
            where: eq(gradeDefinitions.semesterId, activeSemester.id),
        });

        // 3. Resolve per-pillar grading permissions for the current user
        const graderCtx: GraderContext = {
            userId,
            userRole: role,
            userAreaId: currentAreaId,
            customPermissions: session.user.customPermissions,
        };

        const pillarIds = pillars.map(p => p.id);
        const pillarPermissions: Record<string, GradingScope> = pillarIds.length > 0
            ? await resolveAllPillarPermissions(graderCtx, pillarIds)
            : {};

        // Determine if user can grade at least one pillar (for any scope)
        const canGradeAny = Object.values(pillarPermissions).some(scope => scope !== "NONE");

        // 4. Get members to grade/view
        // Visibility: if can view all → all active non-DEV users
        //             if can view own area → only own area members
        // Grading scope is per-pillar (handled in frontend + enforced in upsertGradeAction)
        let targetUsers: Awaited<ReturnType<typeof db.query.users.findMany>>;

        if (canViewAll) {
            targetUsers = await db.query.users.findMany({
                where: and(
                    ne(users.role, "DEV"),
                    eq(users.status, "ACTIVE")
                ),
                with: { currentArea: true },
                orderBy: [asc(users.currentAreaId), asc(users.name)]
            });
        } else {
            targetUsers = await db.query.users.findMany({
                where: and(
                    eq(users.currentAreaId, currentAreaId!),
                    ne(users.role, "DEV"),
                    eq(users.status, "ACTIVE"),
                    ne(users.id, userId)
                ),
                with: { currentArea: true },
                orderBy: [asc(users.name)]
            });
        }

        const visibleUserIds = targetUsers.map(u => u.id);

        // 5. Get Existing Grades
        const existingGrades = visibleUserIds.length === 0
            ? []
            : await db.query.grades.findMany({
                with: { definition: true },
                where: (grades, { exists, and, eq, inArray }) => and(
                    inArray(grades.userId, visibleUserIds),
                    exists(
                        db.select()
                            .from(gradeDefinitions)
                            .where(and(
                                eq(gradeDefinitions.id, grades.definitionId),
                                eq(gradeDefinitions.semesterId, activeSemester.id)
                            ))
                    )
                )
            });

        // 6. Get KPI Summaries
        const kpis = visibleUserIds.length === 0
            ? []
            : await db.query.kpiMonthlySummaries.findMany({
                where: and(
                    eq(kpiMonthlySummaries.semesterId, activeSemester.id),
                    inArray(kpiMonthlySummaries.userId, visibleUserIds)
                )
            });

        const kpiMap: Record<string, number> = {};
        kpis.forEach(k => {
            kpiMap[k.userId] = k.finalKpiScore || 0;
        });

        // 7. Structure grades map
        const gradesMap: Record<string, Record<string, any>> = {};
        existingGrades.forEach(g => {
            if (!gradesMap[g.userId]) gradesMap[g.userId] = {};
            if (g.definition.semesterId === activeSemester.id) {
                gradesMap[g.userId][g.definitionId] = g;
            }
        });

        return {
            success: true,
            data: {
                semester: activeSemester,
                pillars,
                users: targetUsers,
                grades: gradesMap,
                kpis: kpiMap,
                currentUserRole: role,
                // Grader's area ID for client-side OWN_AREA scope validation
                graderAreaId: currentAreaId ?? null,
                permissions: {
                    canViewOwnArea,
                    canViewAll,
                    canGradeAny,
                    // Per-pillar scope map: { [pillarId]: "ALL" | "OWN_AREA" | "NONE" }
                    pillarPermissions,
                }
            }
        };

    } catch (error: any) {
        console.error("Error fetching grading sheet:", error);
        return { success: false, error: "Error al cargar la hoja de calificaciones." };
    }
}
