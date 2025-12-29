
import * as dotenv from "dotenv";
dotenv.config();

import { db } from "@/db";
import { events, semesters, users } from "@/db/schema";
import { eq, and, or, isNull, gte, desc } from "drizzle-orm";

async function main() {

    console.log("🔍 DIAGNOSTICANDO DASHBOARD EVENTS (DEEP DIVE)...");

    // 1. Check All Semesters
    const allSemesters = await db.query.semesters.findMany();
    console.log("\n📅 TODOS LOS SEMESTRES:");
    allSemesters.forEach(s => {
        console.log(`- [${s.isActive ? "ACTIVO" : "INACTIVO"}] ${s.name} (${s.id})`);
    });

    const activeSemester = allSemesters.find(s => s.isActive);
    if (!activeSemester) {
        console.error("❌ CRITICAL: NO HAY SEMESTRE ACTIVO.");
    }

    // 2. Find MOST RECENT Events (Global)
    const recentEvents = await db.query.events.findMany({
        orderBy: [desc(events.createdAt)], // Assuming createdAt exists, or date
        limit: 5,
        with: {
            semester: true
        }
    });

    console.log("\n🕵️ ÚLTIMOS 5 EVENTOS CREADOS (GLOBAL):");
    recentEvents.forEach(e => {
        console.log(`- "${e.title}" | Date: ${new Date(e.date).toLocaleDateString()} | Semester: ${e.semester.name} | CreatedAt: ${e.createdAt}`);
    });
}

main().catch(console.error).finally(() => process.exit(0));
