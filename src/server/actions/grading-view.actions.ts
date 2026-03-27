"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import { users, gradeDefinitions, grades, semesters, kpiMonthlySummaries } from "@/db/schema";
import { eq, and, ne, asc, inArray } from "drizzle-orm";

export async function getGradingSheetAction() {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };

        const role = session.user.role || "";
        const currentAreaId = session.user.currentAreaId;
        const userId = session.user.id;
        const canViewOwnArea = hasPermission(role, "grade:view_own_area", session.user.customPermissions);
        const canViewAll = hasPermission(role, "grade:view_all", session.user.customPermissions);
        const canAssignOwnArea = hasPermission(role, "grade:assign_own_area", session.user.customPermissions);
        const canAssignAll = hasPermission(role, "grade:assign_all", session.user.customPermissions);

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
        // Sorted by name or weight logic? Let's sort manually if needed or name.
        // Usually we want a specific order: Reunion, Staff, Proyectos, Area, CD. 
        // We can sort in frontend or here.
        const pillars = await db.query.gradeDefinitions.findMany({
            where: eq(gradeDefinitions.semesterId, activeSemester.id),
        });

        // 3. Get members to grade
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
                    eq(users.currentAreaId, currentAreaId!), // Validated above
                    ne(users.role, "DEV"),
                    eq(users.status, "ACTIVE"),
                    // Optional: Exclude myself? 
                    ne(users.id, userId)
                ),
                with: { currentArea: true },
                orderBy: [asc(users.name)]
            });
        }

        const visibleUserIds = targetUsers.map(u => u.id);

        // 4. Get Existing Grades for the visible users in this semester
        // We can optimize this by fetching only grades of these users
        // But for < 100 users, finding all grades in semester is fine.
        const existingGrades = visibleUserIds.length === 0
            ? []
            : await db.query.grades.findMany({
                with: {
                    definition: true
                },
                where: (grades, { exists, and, eq, inArray }) => and(
                    inArray(grades.userId, visibleUserIds),
                    // Filter grades only for the active semester's pillars
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

        // 5. Get KPI Summaries
        // We want the LATEST summary for this semester (or current month? The requirement implies "The KPI").
        // Since we are creating one-per-month logic in service, let's just grab the one with highest ID or check logical grouping.
        // Actually, for "Semester Grading", we might want the accumulative. But for V1, we saved to `month: currentMonth`.
        // Let's fetch ALL summaries for this semester and these users, and maybe map them.
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
            // If multiple months exists, what do we show? 
            // We show the latest update or sum?
            // Given the instructions, we overwrite the record. So there should be one main record per month.
            // Let's take the one with highest month or latest update.
            // Ideally we filter by current month/year if that's the view context.
            // Simplification: Last updated score.
            kpiMap[k.userId] = k.finalKpiScore || 0;
        });

        // 5. Structure Data for Grid
        // We need mapped grades: { [userId]: { [pillarId]: GradeObject } }
        const gradesMap: Record<string, Record<string, any>> = {};

        existingGrades.forEach(g => {
            if (!gradesMap[g.userId]) gradesMap[g.userId] = {};
            // If the pillar belongs to active semester (double check logic)
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
                permissions: {
                    canViewOwnArea,
                    canViewAll,
                    canAssignOwnArea,
                    canAssignAll,
                }
            }
        };

    } catch (error: any) {
        console.error("Error fetching grading sheet:", error);
        return { success: false, error: "Error al cargar la hoja de calificaciones." };
    }
}
