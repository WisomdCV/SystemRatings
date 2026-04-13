"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { areas, areaKpiSummaries, semesters, semesterAreas, kpiMonthlySummaries, users, grades, attendanceRecords, gradeDefinitions } from "@/db/schema";
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

const ATTENDANCE_GOOD_STATUSES = new Set(["PRESENT", "EXCUSED"]);

function clampToFive(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(5, value));
}

function isInTargetMonth(dateValue: Date | string, month: number, year: number): boolean {
    const date = new Date(dateValue);
    return (date.getUTCMonth() + 1) === month && date.getUTCFullYear() === year;
}

function toNormalizedFromPercent(percent: number): number {
    return clampToFive((percent / 100) * 5);
}

function computeAttendancePercent(records: Array<{ status: string | null }>): number {
    if (records.length === 0) return 0;
    const attended = records.filter((record) => ATTENDANCE_GOOD_STATUSES.has(record.status || "")).length;
    return Math.round((attended / records.length) * 100);
}

function getPillarOrder(name: string): number {
    const normalized = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const orderMap: Record<string, number> = {
        "asistencia": 0,
        "reunion general": 1,
        "area": 2,
        "proyectos": 3,
        "staff": 4,
        "liderazgo (cd)": 5,
    };

    return orderMap[normalized] ?? 99;
}

function canAccessDashboardAnalytics(
    session: { user?: { role?: string | null; customPermissions?: string[] } } | null
): boolean {
    if (!session?.user) return false;
    const role = session.user.role || "";
    return hasPermission(role, "dashboard:analytics", session.user.customPermissions);
}

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

        if (!canAccessDashboardAnalytics(session)) {
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

        if (!canAccessDashboardAnalytics(session)) {
            return { success: false, error: "No tienes permisos para ver esta información." };
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
        attendancePercent: number;
        pillars: Array<{ name: string; normalized: number; percentage?: number }>;
    }>;
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };
        if (!canAccessDashboardAnalytics(session)) {
            return { success: false, error: "No tienes permisos para ver esta información." };
        }

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

        const topUserIds = topSummaries.map((summary) => summary.userId);

        const attendanceRows = topUserIds.length === 0
            ? []
            : await db.query.attendanceRecords.findMany({
                where: inArray(attendanceRecords.userId, topUserIds),
                columns: {
                    userId: true,
                    status: true,
                },
                with: {
                    event: {
                        columns: {
                            date: true,
                            semesterId: true,
                        },
                    },
                },
            });

        const attendanceByUser = new Map<string, typeof attendanceRows>();
        for (const row of attendanceRows) {
            const matchesSemester = row.event?.semesterId === activeSemester.id;
            const matchesMonth = row.event?.date ? isInTargetMonth(row.event.date, month, year) : false;
            if (!matchesSemester || !matchesMonth) continue;

            const list = attendanceByUser.get(row.userId) || [];
            list.push(row);
            attendanceByUser.set(row.userId, list);
        }

        // 2. Build the result with pillar breakdowns
        const result = await Promise.all(topSummaries.map(async (st) => {
            const userId = st.userId;

            // Get user's grades for this semester to build pillars (Hard/Soft Skills)
            const userGrades = await db.query.grades.findMany({
                where: eq(grades.userId, userId),
                with: { definition: true }
            });

            const activeGrades = userGrades.filter(g => g.definition.semesterId === activeSemester.id);

            const latestGradeByDefinition = new Map<string, typeof activeGrades[number]>();
            for (const grade of activeGrades) {
                const current = latestGradeByDefinition.get(grade.definitionId);
                const currentTs = current?.createdAt ? new Date(current.createdAt).getTime() : 0;
                const candidateTs = grade.createdAt ? new Date(grade.createdAt).getTime() : 0;
                if (!current || candidateTs >= currentTs) {
                    latestGradeByDefinition.set(grade.definitionId, grade);
                }
            }

            const userAttendancePercent = computeAttendancePercent(attendanceByUser.get(userId) || []);
            const pillars: Array<{ name: string; normalized: number; percentage?: number }> = [];

            // Insert Attendance as a pillar
            pillars.push({
                name: "Asistencia",
                normalized: toNormalizedFromPercent(userAttendancePercent),
                percentage: userAttendancePercent,
            });

            // Insert other grades
            latestGradeByDefinition.forEach(g => {
                pillars.push({
                    name: g.definition.name,
                    normalized: clampToFive((g.score / (g.definition.maxScore || 5)) * 5)
                });
            });

            pillars.sort((a, b) => getPillarOrder(a.name) - getPillarOrder(b.name) || a.name.localeCompare(b.name));

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
                attendancePercent: userAttendancePercent,
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
        if (!canAccessDashboardAnalytics(session)) {
            return { success: false, error: "No tienes permisos para ver esta información." };
        }

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
    data?: Array<{ name: string; normalized: number; percentage?: number }>;
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user) return { success: false, error: "No autorizado" };
        if (!canAccessDashboardAnalytics(session)) {
            return { success: false, error: "No tienes permisos para ver esta información." };
        }

        const activeSemester = await db.query.semesters.findFirst({
            where: eq(semesters.isActive, true)
        });
        if (!activeSemester) return { success: false, error: "No hay un ciclo activo." };

        // Fetch memberships
        const areaMembers = await db.query.users.findMany({
            where: and(
                eq(users.currentAreaId, areaId),
                eq(users.status, "ACTIVE")
            ),
            columns: { id: true }
        });
        const areaMemberIds = areaMembers.map(m => m.id);

        if (areaMemberIds.length === 0) return { success: true, data: [] };

        const definitions = await db.query.gradeDefinitions.findMany({
            where: and(
                eq(gradeDefinitions.semesterId, activeSemester.id)
            ),
            columns: { id: true, name: true, maxScore: true },
        });

        const definitionIds = definitions.map((definition) => definition.id);

        // 1. Calculate Attendance pillar from reviewed attendance records
        const attendanceRows = await db.query.attendanceRecords.findMany({
            where: inArray(attendanceRecords.userId, areaMemberIds),
            columns: { userId: true, status: true },
            with: {
                event: {
                    columns: { date: true, semesterId: true },
                },
            },
        });

        const monthAttendance = attendanceRows.filter((row) => {
            const matchesSemester = row.event?.semesterId === activeSemester.id;
            const matchesMonth = row.event?.date ? isInTargetMonth(row.event.date, month, year) : false;
            return matchesSemester && matchesMonth;
        });

        const attendancePercent = computeAttendancePercent(monthAttendance);
        const avgAttendance = toNormalizedFromPercent(attendancePercent);

        // 2. Fetch grades for these members and keep latest grade per user-definition
        const membersGrades = definitionIds.length === 0
            ? []
            : await db.query.grades.findMany({
                where: and(
                    inArray(grades.userId, areaMemberIds),
                    inArray(grades.definitionId, definitionIds)
                ),
                columns: {
                    userId: true,
                    definitionId: true,
                    score: true,
                    createdAt: true,
                },
            });

        const latestByUserDefinition = new Map<string, typeof membersGrades[number]>();
        for (const grade of membersGrades) {
            const key = `${grade.userId}:${grade.definitionId}`;
            const current = latestByUserDefinition.get(key);
            const currentTs = current?.createdAt ? new Date(current.createdAt).getTime() : 0;
            const candidateTs = grade.createdAt ? new Date(grade.createdAt).getTime() : 0;
            if (!current || candidateTs >= currentTs) {
                latestByUserDefinition.set(key, grade);
            }
        }

        const definitionTotals = new Map<string, { total: number; count: number }>();
        latestByUserDefinition.forEach((grade) => {
            const current = definitionTotals.get(grade.definitionId) || { total: 0, count: 0 };
            current.total += grade.score;
            current.count += 1;
            definitionTotals.set(grade.definitionId, current);
        });

        const pillars: Array<{ name: string; normalized: number; percentage?: number }> = [{
            name: "Asistencia",
            normalized: avgAttendance,
            percentage: attendancePercent,
        }];

        const orderedDefinitions = [...definitions].sort((a, b) => {
            const orderDiff = getPillarOrder(a.name) - getPillarOrder(b.name);
            if (orderDiff !== 0) return orderDiff;
            return a.name.localeCompare(b.name);
        });

        for (const definition of orderedDefinitions) {
            const aggregate = definitionTotals.get(definition.id);
            const avgScore = aggregate && aggregate.count > 0 ? (aggregate.total / aggregate.count) : 0;
            const maxScore = definition.maxScore || 5;
            pillars.push({
                name: definition.name,
                normalized: clampToFive((avgScore / maxScore) * 5),
            });
        }

        return { success: true, data: pillars };

    } catch (error) {
        console.error("Error en getAreaPillarsAction:", error);
        return { success: false, error: "Error interno al calcular Pilares del Área" };
    }
}
