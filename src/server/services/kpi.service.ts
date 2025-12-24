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

    // 4. Define Weights Based on Role (Business Rule V2.0)
    const role = user.role || "MEMBER";
    const isDirectorLevel = ["DIRECTOR", "PRESIDENT", "TREASURER"].includes(role);

    let finalKPI = 0;

    // Weights
    const W_RG = 0.20;      // Reunión General
    const W_STAFF = 0.15;   // Staff
    const W_PROY = 0.35;    // Proyectos

    if (isDirectorLevel) {
        // --- DIRECTOR FORMULA ---
        // RG(20%) + Staff(15%) + Proyectos(35%) + Área(15%) + CD(15%)
        const W_AREA_DIR = 0.15;
        const W_CD = 0.15;

        finalKPI =
            (getNorm("Reunión General") * W_RG) +
            (getNorm("Staff") * W_STAFF) +
            (getNorm("Proyectos") * W_PROY) +
            (getNorm("Área") * W_AREA_DIR) +
            (getNorm("Liderazgo (CD)") * W_CD);

    } else {
        // --- MEMBER FORMULA ---
        // RG(20%) + Staff(15%) + Proyectos(35%) + Área(30%)
        const W_AREA_MEM = 0.30;

        finalKPI =
            (getNorm("Reunión General") * W_RG) +
            (getNorm("Staff") * W_STAFF) +
            (getNorm("Proyectos") * W_PROY) +
            (getNorm("Área") * W_AREA_MEM);
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
