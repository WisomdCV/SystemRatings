"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import { areas, areaKpiSummaries, semesters } from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";

export interface AreaComparisonData {
    areas: Array<{ id: string; name: string; code: string | null }>;
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
        const canViewComparison = ["DEV", "PRESIDENT", "TREASURER", "DIRECTOR", "SUBDIRECTOR"].includes(role);

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

        // 2. Get All Areas (excluding internal/system areas if needed)
        const allAreas = await db.query.areas.findMany({
            orderBy: [asc(areas.name)]
        });

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
                    code: a.code
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
