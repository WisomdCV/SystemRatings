"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { areas, areaKpiSummaries, semesters, semesterAreas, kpiMonthlySummaries, users, grades } from "@/db/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { hasPermission } from "@/lib/permissions";

export interface AreaComparisonData {
    areas: Array<{ id: string; name: string; code: string | null; color: string | null }>;
    months: Array<{ month: number; year: number; label: string }>;
    data: Record<string, Record<string, number>>; // areaId -> "month-year" -> kpi
    rankings: Record<string, Record<string, number>>; // areaId -> "month-year" -> position
}

const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/**
 * Gets area comparison data for the active semester
 */
export async function getAreaComparisonAction(): Promise<{
    success: boolean;
    data?: AreaComparisonData;
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user) {
            return { success: false, error: "No autorizado" };
        }

        // Only allow leadership to see this
        const role = session.user.role || "";
        const canViewComparison = hasPermission(role, "dashboard:area_comparison", session.user.customPermissions);

        if (!canViewComparison) {
            return { success: false, error: "No tienes permisos para ver esta información." };
        }

        // 1. Get Active Semester
        const activeSemester = await db.query.semesters.findFirst({
            where: eq(semesters.isActive, true)
        });

        if (!activeSemester) {
            return { success: false, error: "No hay un ciclo activo." };
        }

        // 2. Get areas active in this semester (via semesterAreas pivot)
        const activeSemesterAreas = await db.query.semesterAreas.findMany({
            where: and(
                eq(semesterAreas.semesterId, activeSemester.id),
                eq(semesterAreas.isActive, true),
            ),
        });

        let allAreas;
        if (activeSemesterAreas.length > 0) {
            // Only show areas that are active in this semester
            const activeAreaIds = activeSemesterAreas.map(sa => sa.areaId);
            allAreas = await db.query.areas.findMany({
                where: inArray(areas.id, activeAreaIds),
                orderBy: [asc(areas.name)],
            });
        } else {
            // Fallback: no semester-area records yet → show all areas
            allAreas = await db.query.areas.findMany({
                orderBy: [asc(areas.name)],
            });
        }

        // 3. Get All Area KPI Summaries for this semester
        const summaries = await db.query.areaKpiSummaries.findMany({
            where: eq(areaKpiSummaries.semesterId, activeSemester.id),
            orderBy: [asc(areaKpiSummaries.year), asc(areaKpiSummaries.month)]
        });

        // 4. Extract unique months from the data
        const monthsSet = new Map<string, { month: number; year: number }>();
        summaries.forEach(s => {
            const key = `${s.year}-${s.month}`;
            if (!monthsSet.has(key)) {
                monthsSet.set(key, { month: s.month, year: s.year });
            }
        });

        const months = Array.from(monthsSet.values())
            .sort((a, b) => a.year - b.year || a.month - b.month)
            .map(m => ({
                month: m.month,
                year: m.year,
                label: MONTH_NAMES[m.month]
            }));

        // 5. Build data matrix
        const data: Record<string, Record<string, number>> = {};
        const rankings: Record<string, Record<string, number>> = {};

        summaries.forEach(s => {
            const key = `${s.month}-${s.year}`;

            if (!data[s.areaId]) data[s.areaId] = {};
            if (!rankings[s.areaId]) rankings[s.areaId] = {};

            data[s.areaId][key] = s.averageKpi || 0;
            rankings[s.areaId][key] = s.rankingPosition || 0;
        });

        return {
            success: true,
            data: {
                areas: allAreas.map(a => ({
                    id: a.id,
                    name: a.name,
                    code: a.code,
                    color: a.color
                })),
                months,
                data,
                rankings
            }
        };

    } catch (error: any) {
        console.error("Error fetching area comparison:", error);
        return { success: false, error: "Error al cargar comparación de áreas." };
    }
}

/**
 * Gets area comparison for a specific month
 */
export async function getAreaMonthlyRankingAction(month: number, year: number): Promise<{
    success: boolean;
    data?: Array<{ areaId: string; areaName: string; areaCode: string | null; kpi: number; ranking: number }>;
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user) {
            return { success: false, error: "No autorizado" };
        }

        // 1. Get Active Semester
        const activeSemester = await db.query.semesters.findFirst({
            where: eq(semesters.isActive, true)
        });

        if (!activeSemester) {
            return { success: false, error: "No hay un ciclo activo." };
        }

        // 2. Get summaries for this month
        const summaries = await db.query.areaKpiSummaries.findMany({
            where: and(
                eq(areaKpiSummaries.semesterId, activeSemester.id),
                eq(areaKpiSummaries.month, month),
                eq(areaKpiSummaries.year, year)
            ),
            with: {
                area: true
            },
            orderBy: [asc(areaKpiSummaries.rankingPosition)]
        });

        const result = summaries.map(s => ({
            areaId: s.areaId,
            areaName: (s as any).area?.name || "Área",
            areaCode: (s as any).area?.code || null,
            kpi: s.averageKpi || 0,
            ranking: s.rankingPosition || 0
        }));

        return { success: true, data: result };

    } catch (error: any) {
        console.error("Error fetching monthly ranking:", error);
        return { success: false, error: "Error al cargar ranking mensual." };
    }
}

/**
 * Gets the top 5 members globally for a specific month, including their pillar breakdown
 */
export async function getTopMembersGlobalAction(month: number, year: number): Promise<{
    success: boolean;
    data?: Array<{
        user: { id: string; name: string; image: string | null; role: string | null };
        area: { name: string; code: string | null } | null;
        kpi: number;
        pillars: Array<{ name: string; normalized: number }>;
    }>;
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };

        const activeSemester = await db.query.semesters.findFirst({
            where: eq(semesters.isActive, true)
        });
        if (!activeSemester) return { success: false, error: "No hay un ciclo activo." };

        // 1. Fetch top 5 summaries
        const topSummaries = await db.query.kpiMonthlySummaries.findMany({
            where: and(
                eq(kpiMonthlySummaries.semesterId, activeSemester.id),
                eq(kpiMonthlySummaries.month, month),
                eq(kpiMonthlySummaries.year, year)
            ),
            with: {
                user: {
                    with: {
                        currentArea: true
                    }
                }
            },
            orderBy: [desc(kpiMonthlySummaries.finalKpiScore)],
            limit: 5
        });

        // 2. Build the result with pillar breakdowns
        const result = await Promise.all(topSummaries.map(async (st) => {
            const userId = st.userId;

            // Get user's grades for this semester to build pillars (Hard/Soft Skills)
            const userGrades = await db.query.grades.findMany({
                where: eq(grades.userId, userId),
                with: { definition: true }
            });

            const activeGrades = userGrades.filter(g => g.definition.semesterId === activeSemester.id);

            const pillars: Array<{ name: string; normalized: number }> = [];

            // Insert Attendance as a pillar
            pillars.push({
                name: "Asistencia",
                normalized: (st.attendanceScore || 0) / 2 // Attendance max score is 10, normalized to 5
            });

            // Insert other grades
            activeGrades.forEach(g => {
                pillars.push({
                    name: g.definition.name,
                    normalized: ((g.score / (g.definition.maxScore || 5)) * 5)
                });
            });

            return {
                user: {
                    id: st.user.id,
                    name: st.user.name || "Usuario",
                    image: st.user.image,
                    role: st.user.role
                },
                area: st.user.currentArea ? {
                    name: st.user.currentArea.name,
                    code: st.user.currentArea.code
                } : null,
                kpi: st.finalKpiScore || 0,
                pillars
            };
        }));

        return { success: true, data: result };

    } catch (error) {
        console.error("Error en getTopMembersGlobalAction:", error);
        return { success: false, error: "Error interno al cargar Top Members" };
    }
}

/**
 * Gets the performance distribution (Status mapping) of all members for a given month
 */
export async function getPerformanceDistributionAction(month: number, year: number): Promise<{
    success: boolean;
    data?: { sobresaliente: number; bueno: number; enRiesgo: number; total: number };
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };

        const activeSemester = await db.query.semesters.findFirst({
            where: eq(semesters.isActive, true)
        });
        if (!activeSemester) return { success: false, error: "No hay un ciclo activo." };

        const summaries = await db.query.kpiMonthlySummaries.findMany({
            where: and(
                eq(kpiMonthlySummaries.semesterId, activeSemester.id),
                eq(kpiMonthlySummaries.month, month),
                eq(kpiMonthlySummaries.year, year)
            )
        });

        let sobresaliente = 0;
        let bueno = 0;
        let enRiesgo = 0;

        summaries.forEach((s) => {
            const score = s.finalKpiScore || 0;
            if (score >= 9.0) sobresaliente++;
            else if (score >= 7.5) bueno++;
            else enRiesgo++;
        });

        return {
            success: true,
            data: {
                sobresaliente,
                bueno,
                enRiesgo,
                total: summaries.length
            }
        };

    } catch (error) {
        console.error("Error en getPerformanceDistributionAction:", error);
        return { success: false, error: "Error interno al cargar Distribución de Desempeño" };
    }
}

/**
 * Gets the averaged pillars (competencies) for an entire area
 */
export async function getAreaPillarsAction(areaId: string, month: number, year: number): Promise<{
    success: boolean;
    data?: Array<{ name: string; normalized: number }>;
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };

        const activeSemester = await db.query.semesters.findFirst({
            where: eq(semesters.isActive, true)
        });
        if (!activeSemester) return { success: false, error: "No hay un ciclo activo." };

        // Fetch memberships
        const areaMembers = await db.query.users.findMany({
            where: eq(users.currentAreaId, areaId)
        });
        const areaMemberIds = areaMembers.map(m => m.id);

        if (areaMemberIds.length === 0) return { success: true, data: [] };

        // 1. Calculate Average Attendance Pillar
        const summaries = await db.query.kpiMonthlySummaries.findMany({
            where: and(
                inArray(kpiMonthlySummaries.userId, areaMemberIds),
                eq(kpiMonthlySummaries.semesterId, activeSemester.id),
                eq(kpiMonthlySummaries.month, month),
                eq(kpiMonthlySummaries.year, year)
            )
        });

        let totalAttendance = 0;
        summaries.forEach(s => totalAttendance += (s.attendanceScore || 0));
        const avgAttendance = summaries.length > 0 ? (totalAttendance / summaries.length) / 2 : 0; // scaled to 5

        // 2. Fetch Grades for these members
        const membersGrades = await db.query.grades.findMany({
            where: inArray(grades.userId, areaMemberIds),
            with: { definition: true }
        });

        // Group by definition name
        const pillarMap = new Map<string, { total: number, count: number, maxScore: number }>();
        membersGrades.forEach(g => {
            if (g.definition.semesterId !== activeSemester.id) return;
            const defName = g.definition.name;
            if (!pillarMap.has(defName)) pillarMap.set(defName, { total: 0, count: 0, maxScore: g.definition.maxScore || 5 });

            const p = pillarMap.get(defName)!;
            p.total += g.score;
            p.count += 1;
        });

        const pillars = [{ name: "Asistencia", normalized: avgAttendance }];

        pillarMap.forEach((val, key) => {
            const avgScore = val.total / val.count;
            pillars.push({
                name: key,
                normalized: (avgScore / val.maxScore) * 5
            });
        });

        return { success: true, data: pillars };

    } catch (error) {
        console.error("Error en getAreaPillarsAction:", error);
        return { success: false, error: "Error interno al calcular Pilares del Área" };
    }
}
