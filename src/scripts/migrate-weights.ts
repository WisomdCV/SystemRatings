
import "dotenv/config";
import { db } from "../db";
import { gradeDefinitions } from "../db/schema";
import { like, eq } from "drizzle-orm";

async function main() {
    console.log("🚀 Starting Weight Migration...");

    // 1. Update "Área" Pillars
    // Set directorWeight = 15 for all existing "Área" pillars
    const resultArea = await db.update(gradeDefinitions)
        .set({ directorWeight: 15 })
        .where(like(gradeDefinitions.name, "%Área%"))
        .returning();

    console.log(`✅ Updated ${resultArea.length} 'Área' pillars with directorWeight=15.`);

    // 2. Ensure "CD" Pillars are isDirectorOnly
    const resultCD = await db.update(gradeDefinitions)
        .set({ isDirectorOnly: true, directorWeight: 15 }) // Also set directorWeight just in case
        .where(like(gradeDefinitions.name, "%Liderazgo%"))
        .returning();

    console.log(`✅ Updated ${resultCD.length} 'CD' pillars.`);

    console.log("🏁 Migration Complete.");
}

main().catch(console.error);
