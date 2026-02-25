/**
 * ONE-TIME FIX: Update grade_definitions that have weight=0 to correct weights.
 * 
 * Root Cause: seed.ts was inserting all definitions with weight:0. 
 * When seed ran again, it deleted old (correct) definitions and replaced 
 * them with weight=0 ones. This broke KPI calculation for all users 
 * whose grades reference these definitions.
 * 
 * Run: npx tsx src/db/fix-grade-weights.ts
 */

import "dotenv/config";
import { db } from "./index";
import { gradeDefinitions, semesters } from "./schema";
import { eq, and } from "drizzle-orm";

async function fixGradeWeights() {
    console.log("🔧 Fixing grade definition weights...");

    // 1. Get active semester
    const activeSemester = await db.query.semesters.findFirst({
        where: eq(semesters.isActive, true)
    });

    if (!activeSemester) {
        console.error("❌ No active semester found.");
        process.exit(1);
    }

    console.log(`📅 Active semester: ${activeSemester.name} (${activeSemester.id})`);

    // 2. Get all definitions for this semester
    const defs = await db.query.gradeDefinitions.findMany({
        where: eq(gradeDefinitions.semesterId, activeSemester.id)
    });

    console.log(`📋 Found ${defs.length} definitions:`);
    for (const d of defs) {
        console.log(`   - "${d.name}" id=${d.id} weight=${d.weight} dirWeight=${d.directorWeight} max=${d.maxScore}`);
    }

    // 3. Apply correct weights to ALL definitions (not just weight=0, to ensure consistency)
    const weightMap: Record<string, { weight: number; directorWeight: number | null }> = {
        "Reunión General": { weight: 20, directorWeight: null },
        "Staff": { weight: 15, directorWeight: null },
        "Proyectos": { weight: 35, directorWeight: null },
        "Área": { weight: 30, directorWeight: 15 },
        "Liderazgo (CD)": { weight: 0, directorWeight: 15 },
    };

    for (const def of defs) {
        const correctWeights = weightMap[def.name];
        if (!correctWeights) {
            console.log(`   ⚠️ Unknown pillar "${def.name}", skipping.`);
            continue;
        }

        if (def.weight === correctWeights.weight && def.directorWeight === correctWeights.directorWeight) {
            console.log(`   ✅ "${def.name}" already correct (w=${def.weight}, dw=${def.directorWeight})`);
            continue;
        }

        await db.update(gradeDefinitions)
            .set({
                weight: correctWeights.weight,
                directorWeight: correctWeights.directorWeight,
            })
            .where(eq(gradeDefinitions.id, def.id));

        console.log(`   🔧 Fixed "${def.name}": weight ${def.weight} → ${correctWeights.weight}, dirWeight ${def.directorWeight} → ${correctWeights.directorWeight}`);
    }

    console.log("\n✅ All grade definition weights fixed!");
    console.log("ℹ️  Now re-grade any user to trigger KPI recalculation, or recalculate all KPIs manually.");
    process.exit(0);
}

fixGradeWeights().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
