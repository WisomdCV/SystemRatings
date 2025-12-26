import { db } from "@/db";
import { grades, gradeDefinitions, kpiMonthlySummaries, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Normalizes any score to a Base 10 scale.
 * Formula: (RawInput / MaxScore) * 10
 */
function normalizeScore(rawScore: number, maxScore: number): number {
    if (maxScore === 0) return 0; // Prevent division by zero
    return (rawScore / maxScore) * 10;
}

/**
 * Calculates the KPI for a specific user in a semester.
 * Applies strict business logic for weights based on role.
 */
export async function recalculateUserKPI(userId: string, semesterId: string) {
    console.log(`📊 Recalculating KPI for User: ${userId}, Semester: ${semesterId}`);

    // 1. Fetch User Role & Data
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { id: true, role: true }
    });

    if (!user) throw new Error("User not found");

    // 2. Fetch All Grades for this User/Semester
    const userGrades = await db.query.grades.findMany({
        where: eq(grades.userId, userId),
        with: {
            definition: true // To get MaxScore and Name
        }
    });

    // 3. Map Grades by Pillar Name for easy access
    const gradeMap = new Map<string, { raw: number, max: number, normalized: number }>();

    for (const g of userGrades) {
        if (g.definition.semesterId !== semesterId) continue; // Safety check

        const raw = g.score;
        const max = g.definition.maxScore || 5; // Default safety
        const norm = normalizeScore(raw, max);

        gradeMap.set(g.definition.name, { raw, max, normalized: norm });
    }

    // Helper to safely get normalized score (default 0 if no grade)
    const getNorm = (name: string) => gradeMap.get(name)?.normalized || 0;

    // 5. Define Weights Based on Role (Business Rule V2.0 - Dynamic)
    const role = user.role || "MEMBER";
    const isDirectorLevel = ["DIRECTOR", "PRESIDENT", "TREASURER"].includes(role);

    let finalKPI = 0;

    // We iterate over the definitions found in the user grades (or ideally, all definitions for the semester)
    // Assuming grades exist for all active pillars (since we upsert 0).
    // Better Approach: Iterate over the map entries to capture all present grades.

    for (const [name, data] of gradeMap.entries()) {
        const { raw, max, normalized } = data;

        // Find the definition object from the raw grades logic above is tricky without the full object.
        // Let's retrieve the definition from the original array.
        const gradeEntry = userGrades.find(g => g.definition.name === name);
        if (!gradeEntry) continue;
        const def = gradeEntry.definition;

        // --- RULE 1: EXCLUSION ---
        // If pilar is Director Only AND user is NOT director => Skip completely.
        if (def.isDirectorOnly && !isDirectorLevel) {
            continue;
        }

        // --- RULE 2: PRIORITY FALLBACK (WEIGHT) ---
        // If Director AND directorWeight exists => Use directorWeight
        // Else => Use standard weight
        let weightToUse = def.weight;

        // Ensure directorWeight is treated as number if present
        if (isDirectorLevel && def.directorWeight !== null && def.directorWeight !== undefined) {
            weightToUse = def.directorWeight;
        }

        // Calculation: Normalized (0-10) * (Weight / 100) -> Contribution to Final (0-10)
        // Example: Score 10 * (30 / 100) = 3.0 points
        /* 
           Wait, logic in previous code was: 
           (getNorm("RG") * 0.20)
           Here: 
           (normalized * (weightToUse / 100))
           Correct.
        */

        // Safety: ensure weight is valid number
        // console.log(`[KPI] Pillar: ${name}, Role: ${isDirectorLevel ? 'DIR' : 'MEM'}, Weight: ${weightToUse}, Score: ${normalized}`);

        finalKPI += (normalized * (weightToUse / 100)); // Divide by 100 as weights are 20, 30, etc.
    }

    // 5. Save Snapshot to DB
    // We use Month = 0, Year = 0 as a placeholder for "Current Semester Accumulatord" 
    // OR we actually calculate strictly monthly? 
    // The requirement implies a continuous "Semester" grade, usually managed monthly.
    // For now, let's assume this updates the "Current Month" entry or a generic entry.
    // Given the simplicity requested, let's update a summary record.

    // Correction: The schema asks for month/year. We usually Grade per Month.
    // For this implementation, we will update the entry for the CURRENT MONTH.
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    // Check if summary exists for this month
    const existingSummary = await db.query.kpiMonthlySummaries.findFirst({
        where: and(
            eq(kpiMonthlySummaries.userId, userId),
            eq(kpiMonthlySummaries.semesterId, semesterId),
            eq(kpiMonthlySummaries.month, currentMonth),
            eq(kpiMonthlySummaries.year, currentYear)
        )
    });

    if (existingSummary) {
        await db.update(kpiMonthlySummaries).set({
            finalKpiScore: finalKPI,
            appliedRole: role, // SNAPSHOT THE ROLE
            lastUpdated: new Date()
        }).where(eq(kpiMonthlySummaries.id, existingSummary.id));
    } else {
        await db.insert(kpiMonthlySummaries).values({
            userId,
            semesterId,
            month: currentMonth,
            year: currentYear,
            finalKpiScore: finalKPI,
            attendanceScore: 0, // Pending integration
            appliedRole: role, // SNAPSHOT THE ROLE
        });
    }

    console.log(`✅ KPI Calculated: ${finalKPI.toFixed(2)} (Role: ${role})`);
    return finalKPI;
}
