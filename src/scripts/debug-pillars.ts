import "dotenv/config";
import { db } from "../db";
import { gradeDefinitions, semesters } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
    const active = await db.query.semesters.findFirst({
        where: eq(semesters.isActive, true)
    });

    if (!active) {
        console.log("No active semester");
        return;
    }

    console.log("Active Semester:", active.name, active.id);

    const pillars = await db.query.gradeDefinitions.findMany({
        where: eq(gradeDefinitions.semesterId, active.id)
    });

    console.table(pillars.map(p => ({ id: p.id, name: p.name, max: p.maxScore })));
}

main();
