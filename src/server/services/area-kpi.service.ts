import { db } from "@/db";
import { users, kpiMonthlySummaries, areaKpiSummaries, areas } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Recalculates the average KPI for an area in a specific month/year.
 * Also updates the ranking position for all areas.
 */
export async function recalculateAreaKPI(
    areaId: string,
    semesterId: string,
    month: number,
    year: number
) {
    console.log(`📊 Recalculating Area KPI: Area=${areaId}, Month=${month}/${year}`);

    try {
        // 1. Get all active users in this area
        const areaMembers = await db.query.users.findMany({
            where: and(
                eq(users.currentAreaId, areaId),
                eq(users.status, "ACTIVE")
            ),
            columns: { id: true }
        });

        if (areaMembers.length === 0) {
            console.log("⚠️ No active members in area, skipping.");
            return null;
        }

        // 2. Get KPI summaries for this month for all area members
        const memberKpis = await db.query.kpiMonthlySummaries.findMany({
            where: and(
                eq(kpiMonthlySummaries.semesterId, semesterId),
                eq(kpiMonthlySummaries.month, month),
                eq(kpiMonthlySummaries.year, year)
            )
        });

        // Filter to only members of this area
        const memberIds = areaMembers.map(m => m.id);
        const areaKpis = memberKpis.filter(k => memberIds.includes(k.userId));

        if (areaKpis.length === 0) {
            console.log("⚠️ No KPI data for area members this month.");
            return null;
        }

        // 3. Calculate average
        const total = areaKpis.reduce((sum, k) => sum + (k.finalKpiScore || 0), 0);
        const average = total / areaKpis.length;

        console.log(`✅ Area average: ${average.toFixed(2)} (from ${areaKpis.length} members)`);

        // 4. Upsert area summary
        const existing = await db.query.areaKpiSummaries.findFirst({
            where: and(
                eq(areaKpiSummaries.areaId, areaId),
                eq(areaKpiSummaries.semesterId, semesterId),
                eq(areaKpiSummaries.month, month),
                eq(areaKpiSummaries.year, year)
            )
        });

        if (existing) {
            await db.update(areaKpiSummaries)
                .set({ averageKpi: average })
                .where(eq(areaKpiSummaries.id, existing.id));
        } else {
            await db.insert(areaKpiSummaries).values({
                areaId,
                semesterId,
                month,
                year,
                averageKpi: average
            });
        }

        // 5. Update rankings for ALL areas in this month
        await updateAreaRankings(semesterId, month, year);

        return average;
    } catch (error) {
        console.error("Error recalculating area KPI:", error);
        return null;
    }
}

/**
 * Updates ranking positions for all areas based on their average KPI
 */
async function updateAreaRankings(semesterId: string, month: number, year: number) {
    // Get all area summaries for this month
    const allAreaSummaries = await db.query.areaKpiSummaries.findMany({
        where: and(
            eq(areaKpiSummaries.semesterId, semesterId),
            eq(areaKpiSummaries.month, month),
            eq(areaKpiSummaries.year, year)
        )
    });

    // Sort by average KPI descending
    const sorted = [...allAreaSummaries].sort((a, b) =>
        (b.averageKpi || 0) - (a.averageKpi || 0)
    );

    // Update each with its ranking
    for (let i = 0; i < sorted.length; i++) {
        await db.update(areaKpiSummaries)
            .set({ rankingPosition: i + 1 })
            .where(eq(areaKpiSummaries.id, sorted[i].id));
    }

    console.log(`📊 Updated rankings for ${sorted.length} areas`);
}

/**
 * Recalculates area KPI for a user's area.
 * Convenience wrapper that looks up the user's area.
 */
export async function recalculateAreaKPIForUser(
    userId: string,
    semesterId: string,
    month: number,
    year: number
) {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { currentAreaId: true }
    });

    if (!user?.currentAreaId) {
        console.log("⚠️ User has no area assigned, skipping area KPI calculation.");
        return null;
    }

    return recalculateAreaKPI(user.currentAreaId, semesterId, month, year);
}
