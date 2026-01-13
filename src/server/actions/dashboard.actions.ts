"use server";

import { auth } from "@/server/auth";
import { db } from "@/db";
import {
    users,
    grades,
    gradeDefinitions,
    kpiMonthlySummaries,
    semesters,
    areaKpiSummaries
} from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";

export interface DashboardData {
    kpi: {
        current: number;
        previousMonth: number | null;
        ranking: { position: number; total: number } | null;
    };
    grades: {
        pillars: Array<{
            name: string;
            score: number;
            maxScore: number;
            normalized: number; // 0-5 scale for radar
        }>;
    };
    history: {
        monthly: Array<{
            month: string;
            year: number;
            myKpi: number;
            areaAvg: number | null;
        }>;
        semesterly: Array<{
            semester: string;
            myKpi: number;
            areaAvg: number | null;
        }>;
    };
}

/**
 * Fetches all dashboard data for the current user
 */
export async function getMyDashboardDataAction(): Promise<{
    success: boolean;
    data?: DashboardData;
    error?: string
}> {
    try {
        const session = await auth();
        if (!session?.user) {
            return { success: false, error: "No autorizado" };
        }

        const userId = session.user.id;
        const userAreaId = session.user.currentAreaId;

        // 1. Get Active Semester
        const activeSemester = await db.query.semesters.findFirst({
            where: eq(semesters.isActive, true)
        });

        if (!activeSemester) {
            return {
                success: true,
                data: getEmptyDashboardData()
            };
        }

        // 2. Get Current User's Latest KPI Summary
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const latestKpi = await db.query.kpiMonthlySummaries.findFirst({
            where: and(
                eq(kpiMonthlySummaries.userId, userId),
                eq(kpiMonthlySummaries.semesterId, activeSemester.id)
            ),
            orderBy: [desc(kpiMonthlySummaries.year), desc(kpiMonthlySummaries.month)]
        });

        // 3. Get Previous Month KPI (for comparison)
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        const previousKpi = await db.query.kpiMonthlySummaries.findFirst({
            where: and(
                eq(kpiMonthlySummaries.userId, userId),
                eq(kpiMonthlySummaries.semesterId, activeSemester.id),
                eq(kpiMonthlySummaries.month, prevMonth),
                eq(kpiMonthlySummaries.year, prevYear)
            )
        });

        // 4. Get User's Grades for Radar Chart
        const userGrades = await db.query.grades.findMany({
            where: eq(grades.userId, userId),
            with: {
                definition: true
            }
        });

        // Filter grades for active semester and build pillar data
        const pillarsData = userGrades
            .filter(g => g.definition.semesterId === activeSemester.id)
            .map(g => ({
                name: g.definition.name,
                score: g.score,
                maxScore: g.definition.maxScore || 5,
                normalized: ((g.score / (g.definition.maxScore || 5)) * 5) // Normalize to 0-5 scale
            }));

        // 5. Get KPI History (Monthly)
        const kpiHistory = await db.query.kpiMonthlySummaries.findMany({
            where: and(
                eq(kpiMonthlySummaries.userId, userId),
                eq(kpiMonthlySummaries.semesterId, activeSemester.id)
            ),
            orderBy: [asc(kpiMonthlySummaries.year), asc(kpiMonthlySummaries.month)]
        });

        const monthNames = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

        // 6. Get Area Average KPIs for comparison
        let areaAvgMap: Record<string, number> = {};
        if (userAreaId) {
            const areaKpis = await db.query.areaKpiSummaries.findMany({
                where: and(
                    eq(areaKpiSummaries.areaId, userAreaId),
                    eq(areaKpiSummaries.semesterId, activeSemester.id)
                )
            });
            areaKpis.forEach(a => {
                areaAvgMap[`${a.year}-${a.month}`] = a.averageKpi || 0;
            });
        }

        const monthlyHistory = kpiHistory.map(h => ({
            month: monthNames[h.month] || h.month.toString(),
            year: h.year,
            myKpi: h.finalKpiScore || 0,
            areaAvg: areaAvgMap[`${h.year}-${h.month}`] || null
        }));

        // 7. Calculate Ranking (position in area)
        let ranking: { position: number; total: number } | null = null;

        if (userAreaId && latestKpi) {
            // Get all users in same area with their KPIs
            const areaMembers = await db.query.users.findMany({
                where: and(
                    eq(users.currentAreaId, userAreaId),
                    eq(users.status, "ACTIVE")
                )
            });

            const areaMemberIds = areaMembers.map(m => m.id);

            // Get latest KPIs for all area members
            const allAreaKpis = await db.query.kpiMonthlySummaries.findMany({
                where: eq(kpiMonthlySummaries.semesterId, activeSemester.id)
            });

            // Filter to area members and get latest per user
            const latestPerUser: Record<string, number> = {};
            allAreaKpis
                .filter(k => areaMemberIds.includes(k.userId))
                .forEach(k => {
                    const existing = latestPerUser[k.userId];
                    if (!existing || k.finalKpiScore! > existing) {
                        latestPerUser[k.userId] = k.finalKpiScore || 0;
                    }
                });

            // Sort and find position
            const sortedScores = Object.entries(latestPerUser)
                .sort((a, b) => b[1] - a[1]);

            const myPosition = sortedScores.findIndex(([uid]) => uid === userId) + 1;

            ranking = {
                position: myPosition || sortedScores.length + 1,
                total: Math.max(sortedScores.length, areaMembers.length)
            };
        }

        // 8. Build and return dashboard data
        const dashboardData: DashboardData = {
            kpi: {
                current: latestKpi?.finalKpiScore || 0,
                previousMonth: previousKpi?.finalKpiScore || null,
                ranking
            },
            grades: {
                pillars: pillarsData
            },
            history: {
                monthly: monthlyHistory,
                semesterly: [] // Can be implemented later for semester view
            }
        };

        return { success: true, data: dashboardData };

    } catch (error: any) {
        console.error("Error fetching dashboard data:", error);
        return { success: false, error: "Error al cargar datos del dashboard" };
    }
}

/**
 * Returns empty dashboard data structure
 */
function getEmptyDashboardData(): DashboardData {
    return {
        kpi: {
            current: 0,
            previousMonth: null,
            ranking: null
        },
        grades: {
            pillars: []
        },
        history: {
            monthly: [],
            semesterly: []
        }
    };
}
